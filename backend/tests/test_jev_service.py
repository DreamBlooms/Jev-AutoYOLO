from __future__ import annotations

import io
import json
import sys
import types
import urllib.error
from pathlib import Path

import pytest
from PIL import Image

from app.core.config import settings
from app.core.exceptions import InferenceError
from app.services import jev_service, vlm_provider


class FakeTransport:
    def __init__(self, responder):
        self.responder = responder
        self.calls: list[dict] = []

    def ask(self, *, model, questions, headers, image, extra_state=None):
        self.calls.append(
            {
                "model": model,
                "questions": questions,
                "headers": headers,
                "image": image,
                "extra_state": extra_state,
            }
        )
        return self.responder(questions, len(self.calls))


@pytest.fixture(autouse=True)
def _jev_settings(monkeypatch):
    monkeypatch.setattr(settings, "typesafe_api_key", "test-key")
    monkeypatch.setattr(settings, "openrouter_api_key", "")
    monkeypatch.setattr(settings, "jev_provider", "typesafe")
    monkeypatch.setattr(settings, "jev_model", "jev-test")
    monkeypatch.setattr(settings, "jev_present_threshold", 0.5)
    monkeypatch.setattr(settings, "jev_box_confidence_threshold", 0.0)
    monkeypatch.setattr(settings, "jev_multi_instance", "single")
    monkeypatch.setattr(settings, "jev_max_tiles", 4)
    monkeypatch.setattr(settings, "jev_tile_overlap", 0.1)
    monkeypatch.setattr(settings, "jev_max_concurrency", 1)
    with jev_service._state_lock:
        jev_service._jev_state.update(
            {
                "state": jev_service.JevState.UNLOADED,
                "mode": "unconfigured",
                "model": settings.resolved_jev_model,
                "stage": "",
                "progress": 0,
                "error": "",
            }
        )


def _image(tmp_path: Path, width: int = 400, height: int = 400) -> Path:
    path = tmp_path / "image.jpg"
    Image.new("RGB", (width, height), "white").save(path)
    return path


def _single_box_answers(presence=0.9, box=(0.1, 0.2, 0.4, 0.5), count="one"):
    return {
        "answers": {
            "q0_present": {"type": "noul", "noul": presence},
            "q0_box": {
                "type": "box",
                "box": {"left": box[0], "top": box[1], "right": box[2], "bottom": box[3]},
                "confidence": 0.8,
            },
            "q0_count": {"type": "choice", "choice": count, "confidence": 0.9},
        },
        "model": "jev-test",
        "usage": {"input_tokens": 10, "output_tokens": 2},
    }


def test_detect_maps_box_to_pixels(tmp_path):
    transport = FakeTransport(lambda questions, call: _single_box_answers())
    result = jev_service.detect(_image(tmp_path), ["cat"], transport=transport)

    assert result["provider"] == "jev"
    assert result["model_name"] == "Jev (jev-test)"
    assert result["img_w"] == 400 and result["img_h"] == 400
    assert result["boxes"] == [
        {
            "class_name": "cat",
            "x1": 40,
            "y1": 80,
            "x2": 160,
            "y2": 200,
            "confidence": 0.8,
            "presence": 0.9,
        }
    ]
    call = transport.calls[0]
    assert call["headers"] == {"TypeSafe-Danger-Zone-Images": "true"}
    assert call["model"] == "jev-test"
    assert "q0_present" in call["questions"]
    assert call["questions"]["q0_box"]["type"] == "box"
    assert call["image"].size == (400, 400)


def test_status_reflects_configuration(monkeypatch):
    monkeypatch.setattr(settings, "typesafe_api_key", "")
    status = jev_service.get_status()
    assert status["state"] == "unloaded"
    assert status["mode"] == "unconfigured"

    monkeypatch.setattr(settings, "typesafe_api_key", "test-key")
    status = jev_service.get_status()
    assert status["state"] == "loaded"
    assert status["mode"] in ("remote", "local-fallback", "unavailable")


def test_mark_fallback_reports_local_mode(monkeypatch):
    monkeypatch.setattr(settings, "typesafe_api_key", "test-key")
    jev_service.mark_fallback()
    status = jev_service.get_status()
    assert status["mode"] == "local-fallback"
    assert status["state"] == "loaded"


def test_image_asset_uses_pil_adapter():
    asset = jev_service._image_asset(Image.new("RGB", (10, 10), "white"))
    assert type(asset).__name__ == "Image"
    assert asset.type == "image"


def test_detect_through_sdk_mock_transport(tmp_path, monkeypatch):
    import httpx2
    import typesafe_sdk

    def handler(request):
        return httpx2.Response(
            200,
            json={
                "model": "jev-test",
                "answers": {
                    "q0_present": {"type": "noul", "noul": 0.95},
                    "q0_box": {
                        "type": "box",
                        "box": {"left": 0.25, "top": 0.25, "right": 0.75, "bottom": 0.75},
                        "confidence": 0.88,
                    },
                    "q0_count": {
                        "type": "choice",
                        "choice": "one",
                        "confidence": 0.9,
                        "probabilities": {"none": 0.05, "one": 0.9, "several": 0.05},
                    },
                },
                "usage": {"input_tokens": 10, "output_tokens": 2},
            },
        )

    original = typesafe_sdk.TypeSafeClient

    def factory(**kwargs):
        kwargs["transport"] = httpx2.MockTransport(handler)
        return original(**kwargs)

    monkeypatch.setattr(typesafe_sdk, "TypeSafeClient", factory)
    result = jev_service.detect(
        _image(tmp_path, 400, 400), ["cat"], transport=jev_service.JevTransport("key")
    )
    assert result["boxes"] == [
        {
            "class_name": "cat",
            "x1": 100,
            "y1": 100,
            "x2": 300,
            "y2": 300,
            "confidence": 0.88,
            "presence": 0.95,
        }
    ]


def test_detect_appends_extra_instructions_and_state(tmp_path):
    transport = FakeTransport(lambda questions, call: _single_box_answers())
    jev_service.detect(
        _image(tmp_path),
        ["cat"],
        transport=transport,
        extra_state={"scene": "indoor living room"},
        extra_instructions="Only count cats on the sofa.",
    )
    call = transport.calls[0]
    assert call["extra_state"] == {"scene": "indoor living room"}
    instructions = " ".join(q["instructions"] for q in call["questions"].values())
    assert "Only count cats on the sofa." in instructions


def test_extra_state_string_is_placed_in_context(tmp_path):
    transport = FakeTransport(lambda questions, call: _single_box_answers())
    jev_service.detect(
        _image(tmp_path),
        ["cat"],
        transport=transport,
        extra_state="Night-time camera frame.",
    )
    assert transport.calls[0]["extra_state"] == "Night-time camera frame."


def test_category_instructions_are_applied_per_category():
    questions, _ = jev_service._category_questions(
        ["cat", "dog"],
        include_count=False,
        category_instructions={
            "cat": "Only black cats.",
            "dog": "Only small dogs.",
        },
    )
    assert "Only black cats." in questions["q0_box"]["instructions"]
    assert "Only small dogs." not in questions["q0_box"]["instructions"]
    assert "Only small dogs." in questions["q1_box"]["instructions"]


def test_detect_passes_category_instructions(tmp_path):
    transport = FakeTransport(lambda questions, call: _single_box_answers())
    jev_service.detect(
        _image(tmp_path),
        ["cat"],
        transport=transport,
        category_instructions={"cat": "Only cats on the bed."},
    )
    instructions = " ".join(q["instructions"] for q in transport.calls[0]["questions"].values())
    assert "Only cats on the bed." in instructions


def test_detect_gates_box_by_presence(tmp_path):
    transport = FakeTransport(lambda questions, call: _single_box_answers(presence=0.1))
    result = jev_service.detect(_image(tmp_path), ["cat"], transport=transport)
    assert result["boxes"] == []


def test_detect_uses_presence_when_confidence_missing(tmp_path):
    payload = _single_box_answers()
    payload["answers"]["q0_box"]["confidence"] = None
    transport = FakeTransport(lambda questions, call: payload)
    result = jev_service.detect(_image(tmp_path), ["cat"], transport=transport)
    assert result["boxes"][0]["confidence"] == pytest.approx(0.9)


def test_detect_clamps_and_orders_edges(tmp_path):
    payload = _single_box_answers(box=(0.8, 0.9, 0.2, 0.1))
    transport = FakeTransport(lambda questions, call: payload)
    result = jev_service.detect(_image(tmp_path), ["cat"], transport=transport)
    box = result["boxes"][0]
    assert box["x1"] == 80 and box["x2"] == 320
    assert box["y1"] == 40 and box["y2"] == 360


def test_requires_api_key(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "typesafe_api_key", "")
    with pytest.raises(jev_service.JevNotConfiguredError):
        jev_service.detect(_image(tmp_path), ["cat"])


def test_prepare_applies_exif_orientation(tmp_path):
    path = tmp_path / "rotated.jpg"
    image = Image.new("RGB", (400, 200), "white")
    exif = image.getexif()
    exif[274] = 6
    image.save(path, exif=exif)

    with Image.open(path) as source:
        prepared, transform = jev_service.prepare_for_jev(source)
    try:
        assert (transform.original_width, transform.original_height) == (200, 400)
    finally:
        prepared.close()


def test_prepare_resizes_and_pads():
    prepared, transform = jev_service.prepare_for_jev(Image.new("RGB", (4000, 3000)))
    try:
        assert max(prepared.size) <= jev_service.JEV_MAX_SIDE
        assert prepared.size[0] * prepared.size[1] <= jev_service.JEV_MAX_AREA
    finally:
        prepared.close()

    prepared, transform = jev_service.prepare_for_jev(Image.new("RGB", (100, 100)))
    try:
        assert prepared.size == (280, 280)
        assert transform.point_to_original(140, 140) == pytest.approx((50, 50))
    finally:
        prepared.close()

    prepared, transform = jev_service.prepare_for_jev(Image.new("RGB", (2000, 100)))
    try:
        assert prepared.size == (1568, 280)
        x1, y1 = transform.point_to_original(0, transform.pad_top)
        x2, y2 = transform.point_to_original(1568, transform.pad_top + 78)
        assert x1 == pytest.approx(0) and x2 == pytest.approx(2000)
        assert y1 == pytest.approx(0) and y2 == pytest.approx(100)
    finally:
        prepared.close()


def test_multi_instance_uses_tiles(tmp_path):
    settings.jev_multi_instance = "auto"

    def responder(questions, call):
        if "q0_count" in questions:
            return _single_box_answers(box=(0.0, 0.0, 0.5, 0.5), count="several")
        return {
            "answers": {
                "t0_present": {"type": "noul", "noul": 0.9},
                "t0_box": {
                    "type": "box",
                    "box": {"left": 0.25, "top": 0.25, "right": 0.75, "bottom": 0.75},
                    "confidence": 0.7,
                },
            }
        }

    transport = FakeTransport(responder)
    result = jev_service.detect(_image(tmp_path, 800, 800), ["cat"], transport=transport)
    assert len(transport.calls) == 5
    assert len(result["boxes"]) >= 2
    assert all(box["class_name"] == "cat" for box in result["boxes"])
    assert result["several_categories"] == ["cat"]


def test_dedupe_boxes_is_class_aware():
    boxes = [
        {"class_name": "cat", "x1": 0, "y1": 0, "x2": 100, "y2": 100, "confidence": 0.9},
        {"class_name": "cat", "x1": 5, "y1": 5, "x2": 105, "y2": 105, "confidence": 0.5},
        {"class_name": "dog", "x1": 5, "y1": 5, "x2": 105, "y2": 105, "confidence": 0.8},
    ]
    kept = jev_service.dedupe_boxes(boxes)
    assert len(kept) == 2
    assert {box["class_name"] for box in kept} == {"cat", "dog"}


def test_transport_maps_bad_request_without_fallback(monkeypatch):
    import httpx2
    import typesafe_sdk

    def handler(request):
        return httpx2.Response(400, json={"detail": "images are not enabled"})

    original = typesafe_sdk.TypeSafeClient

    def factory(**kwargs):
        kwargs["transport"] = httpx2.MockTransport(handler)
        return original(**kwargs)

    monkeypatch.setattr(typesafe_sdk, "TypeSafeClient", factory)
    transport = jev_service.JevTransport("key")
    with pytest.raises(jev_service.JevRequestError):
        transport.ask(
            model="jev-test",
            questions={"q": {"type": "noul", "instructions": "Is it here?"}},
            headers=jev_service.IMAGE_HEADERS,
            image=Image.new("RGB", (280, 280), "white"),
        )


def test_provider_hands_multi_instance_to_sam3(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "jev_multi_instance", "sam3")
    monkeypatch.setattr(
        jev_service,
        "detect",
        lambda *a, **k: {
            "boxes": [
                {"class_name": "cat", "x1": 0, "y1": 0, "x2": 10, "y2": 10, "confidence": 0.9}
            ],
            "several_categories": ["cat"],
        },
    )
    fake = types.ModuleType("app.services.sam3_client")
    fake.segment_sam3 = lambda *a, **k: [
        {"class_name": "cat", "x1": 50, "y1": 50, "x2": 60, "y2": 60, "confidence": 0.8}
    ]
    monkeypatch.setitem(sys.modules, "app.services.sam3_client", fake)

    result = vlm_provider.detect_with_provider(_image(tmp_path), ["cat"])
    assert result["provider"] == "jev+sam3"
    assert result["used_sam3"] is True
    assert len(result["boxes"]) == 2


def test_provider_keeps_jev_when_sam3_returns_nothing(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "jev_multi_instance", "sam3")
    monkeypatch.setattr(
        jev_service,
        "detect",
        lambda *a, **k: {
            "boxes": [
                {"class_name": "cat", "x1": 0, "y1": 0, "x2": 10, "y2": 10, "confidence": 0.9}
            ],
            "several_categories": ["cat"],
            "provider": "jev",
        },
    )
    fake = types.ModuleType("app.services.sam3_client")
    fake.segment_sam3 = lambda *a, **k: []
    monkeypatch.setitem(sys.modules, "app.services.sam3_client", fake)

    result = vlm_provider.detect_with_provider(_image(tmp_path), ["cat"])
    assert result["provider"] == "jev"
    assert result.get("used_sam3") is not True
    assert len(result["boxes"]) == 1


def _box(x1, y1, x2, y2, source, conf=0.5):
    return {
        "class_name": "cat",
        "x1": x1,
        "y1": y1,
        "x2": x2,
        "y2": y2,
        "confidence": conf,
        "presence": 0.9,
        "source": source,
    }


def _settle(boxes, width, height):
    merged = jev_service._merge_tile_fragments(boxes, width, height)
    return jev_service.dedupe_boxes(merged)


def test_fragment_merge_keeps_one_full_box_for_single_object():
    boxes = [
        _box(120, 40, 435, 305, "full", 0.44),
        _box(131, 39, 262, 174, "tile", 0.39),
        _box(238, 42, 405, 174, "tile", 0.83),
        _box(134, 158, 262, 318, "tile", 0.66),
        _box(238, 158, 433, 312, "tile", 0.87),
    ]
    result = _settle(boxes, 500, 332)
    assert len(result) == 1
    assert result[0]["x1"] == 120 and result[0]["x2"] == 435


def test_fragment_merge_keeps_two_side_by_side_objects():
    boxes = [
        _box(34, 22, 268, 436, "full", 0.22),
        _box(56, 130, 218, 231, "tile", 0.3),
        _box(202, 4, 423, 231, "tile", 0.41),
        _box(28, 209, 221, 426, "tile", 0.67),
        _box(202, 209, 294, 440, "tile", 0.43),
    ]
    result = _settle(boxes, 425, 440)
    assert len(result) == 2
    assert any(box["x1"] == 202 and box["x2"] >= 420 for box in result)


def test_fragment_merge_keeps_two_stacked_objects():
    boxes = [
        _box(96, 39, 276, 151, "full", 0.56),
        _box(90, 58, 155, 218, "tile", 0.5),
        _box(143, 8, 288, 212, "tile", 0.7),
        _box(115, 243, 157, 409, "tile", 0.8),
        _box(143, 210, 232, 403, "tile", 0.88),
    ]
    result = _settle(boxes, 300, 432)
    assert len(result) == 2


def test_dedupe_drops_contained_tile_fragments():
    boxes = [
        {"class_name": "cat", "x1": 0, "y1": 0, "x2": 100, "y2": 100, "confidence": 0.9},
        {"class_name": "cat", "x1": 10, "y1": 95, "x2": 100, "y2": 100, "confidence": 0.8},
        {"class_name": "cat", "x1": 80, "y1": 20, "x2": 100, "y2": 100, "confidence": 0.7},
    ]
    kept = jev_service.dedupe_boxes(boxes)
    assert kept == [boxes[0]]


class FakeUrlOpen:
    def __init__(self, payload=None, error=None):
        self.payload = payload
        self.error = error
        self.requests = []

    def __call__(self, request, timeout=None):
        self.requests.append(request)
        if self.error is not None:
            raise self.error
        return FakeResponse(self.payload)


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def read(self):
        return json.dumps(self.payload).encode()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


def test_get_transport_selects_openrouter(monkeypatch):
    monkeypatch.setattr(settings, "jev_provider", "openrouter")
    monkeypatch.setattr(settings, "openrouter_api_key", "or-key")
    monkeypatch.setattr(settings, "jev_model", "")
    monkeypatch.setattr(settings, "jev_base_url", "")
    monkeypatch.setattr(jev_service, "_transport", None)

    transport = jev_service.get_transport()
    assert isinstance(transport, jev_service.OpenRouterTransport)
    assert transport.base_url == "https://openrouter.ai"
    assert settings.resolved_jev_model == "~typesafe/jev-latest"


def test_openrouter_transport_builds_decisions_request(monkeypatch):
    fake = FakeUrlOpen(
        {
            "model": "typesafe/jev-1.14-20261014",
            "answers": {"q": {"type": "noul", "noul": 0.9}},
            "usage": {"input_tokens": 1, "output_tokens": 1},
        }
    )
    monkeypatch.setattr("urllib.request.urlopen", fake)
    transport = jev_service.OpenRouterTransport("or-key", "https://openrouter.ai", 30)
    payload = transport.ask(
        model="~typesafe/jev-latest",
        questions={"q": {"type": "noul", "instructions": "Is it there?"}},
        headers={},
        image=Image.new("RGB", (280, 280), "white"),
    )
    assert payload["answers"]["q"]["noul"] == 0.9
    request = fake.requests[0]
    assert request.full_url == "https://openrouter.ai/api/alpha/decisions"
    assert request.get_header("Authorization") == "Bearer or-key"
    body = json.loads(request.data)
    assert body["model"] == "~typesafe/jev-latest"
    reference = body["state"]["image"]
    assert body["assets"][reference]["type"] == "image"
    assert body["assets"][reference]["format"] == "jpg"
    assert body["assets"][reference]["data_base64"]


def test_openrouter_transport_maps_400(monkeypatch):
    error_body = io.BytesIO(json.dumps({"error": {"message": "bad request"}}).encode())
    error = urllib.error.HTTPError(
        "https://openrouter.ai/api/alpha/decisions",
        400,
        "Bad Request",
        {},
        error_body,
    )
    monkeypatch.setattr("urllib.request.urlopen", FakeUrlOpen(error=error))
    transport = jev_service.OpenRouterTransport("or-key")
    with pytest.raises(jev_service.JevRequestError, match="bad request"):
        transport.ask(
            model="~typesafe/jev-latest",
            questions={"q": {"type": "noul", "instructions": "Is it there?"}},
            headers={},
            image=Image.new("RGB", (280, 280), "white"),
        )


def test_provider_falls_back_when_no_key(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "typesafe_api_key", "")
    monkeypatch.setattr(vlm_provider, "_local_fallback_available", lambda: True)
    fake = types.ModuleType("app.services.locate_anything")
    fake.detect = lambda path, categories: {
        "boxes": [{"class_name": "cat", "x1": 1, "y1": 2, "x2": 3, "y2": 4}],
        "img_w": 10,
        "img_h": 10,
        "orig_w": 10,
        "orig_h": 10,
        "raw_text": "",
    }
    monkeypatch.setitem(sys.modules, "app.services.locate_anything", fake)
    result = vlm_provider.detect_with_provider(_image(tmp_path), ["cat"])
    assert result["provider"] == "vlm"
    assert result["model_name"] == "LocateAnything-3B"


def test_provider_falls_back_when_jev_is_unavailable(tmp_path, monkeypatch):
    monkeypatch.setattr(vlm_provider, "_local_fallback_available", lambda: True)
    monkeypatch.setattr(
        jev_service,
        "detect",
        lambda *a, **k: (_ for _ in ()).throw(jev_service.JevUnavailableError("down")),
    )
    fake = types.ModuleType("app.services.locate_anything")
    fake.detect = lambda path, categories: {
        "boxes": [],
        "img_w": 10,
        "img_h": 10,
        "orig_w": 10,
        "orig_h": 10,
    }
    monkeypatch.setitem(sys.modules, "app.services.locate_anything", fake)
    result = vlm_provider.detect_with_provider(_image(tmp_path), ["cat"])
    assert result["provider"] == "vlm"


def test_provider_does_not_fall_back_on_bad_request(tmp_path, monkeypatch):
    monkeypatch.setattr(
        jev_service,
        "detect",
        lambda *a, **k: (_ for _ in ()).throw(jev_service.JevRequestError("bad image")),
    )
    with pytest.raises(InferenceError, match="Jev request failed"):
        vlm_provider.detect_with_provider(_image(tmp_path), ["cat"])
