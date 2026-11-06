"""Tests for detection strategy pattern."""

import sys
import types

from app.services.detection_strategy import (
    DetectionResult,
    JevDetection,
    JevWithSAM2,
    SAM3Detection,
    VLMDetection,
    VLMWithSAM2,
    create_strategy,
)


class TestCreateStrategy:
    def test_default_strategy_is_jev(self):
        s = create_strategy()
        assert isinstance(s, JevDetection)

    def test_use_sam2_returns_jev_with_sam2(self, monkeypatch):
        fake = types.ModuleType("app.services.sam2_service")
        fake.segment_image = lambda *args, **kwargs: []
        monkeypatch.setitem(sys.modules, "app.services.sam2_service", fake)
        s = create_strategy(use_sam2=True)
        assert isinstance(s, JevWithSAM2)

    def test_use_sam3_returns_sam3(self):
        s = create_strategy(use_sam3=True)
        assert isinstance(s, SAM3Detection)

    def test_sam3_takes_priority_over_sam2(self):
        s = create_strategy(use_sam2=True, use_sam3=True)
        assert isinstance(s, SAM3Detection)

    def test_use_vlm_returns_local_strategy(self):
        s = create_strategy(use_vlm=True)
        assert isinstance(s, JevDetection)

    def test_use_vlm_with_sam2(self, monkeypatch):
        fake = types.ModuleType("app.services.sam2_service")
        fake.segment_image = lambda *args, **kwargs: []
        monkeypatch.setitem(sys.modules, "app.services.sam2_service", fake)
        s = create_strategy(use_vlm=True, use_sam2=True)
        assert isinstance(s, JevWithSAM2)


class TestDetectionResult:
    def test_default_polygons_is_empty_list(self):
        r = DetectionResult(boxes=[], img_w=100, img_h=100)
        assert r.polygons == []

    def test_polygons_stored(self):
        r = DetectionResult(boxes=[], img_w=100, img_h=100, polygons=[[[1, 2]]])
        assert r.polygons == [[[1, 2]]]

    def test_boxes_and_dims(self):
        boxes = [{"x1": 0, "y1": 0, "x2": 50, "y2": 50, "class_name": "cat"}]
        r = DetectionResult(boxes=boxes, img_w=640, img_h=480, raw_text="cat")
        assert r.img_w == 640
        assert r.img_h == 480
        assert r.raw_text == "cat"
        assert len(r.boxes) == 1


class TestStrategyKwargs:
    def test_sam3_strategy_accepts_use_sam3_seg(self):
        s = SAM3Detection(lambda *a, **kw: [])
        assert s is not None  # SAM3 requires running server, skip actual detect

    def test_vlm_strategy_has_detect_method(self):
        s = VLMDetection(lambda *a, **kw: {})
        assert hasattr(s, "detect")
        assert VLMDetection is JevDetection
        assert VLMWithSAM2 is JevWithSAM2


class TestProviderMetadata:
    def test_jev_metadata_and_scaling(self):
        captured = {}

        def fake_detect(path, categories, **kwargs):
            captured.update(kwargs)
            return {
                "boxes": [{"class_name": "cat", "x1": 10, "y1": 10, "x2": 20, "y2": 20}],
                "img_w": 100,
                "img_h": 100,
                "orig_w": 200,
                "orig_h": 200,
                "raw_text": "{}",
                "model_name": "Jev (jev-test)",
                "provider": "jev",
            }

        result = JevDetection(fake_detect).detect(
            "unused.jpg",
            ["cat"],
            extra_state={"scene": "sofa"},
            extra_instructions="indoor only",
        )
        assert captured["extra_state"] == {"scene": "sofa"}
        assert captured["extra_instructions"] == "indoor only"
        assert captured["category_instructions"] is None
        assert result.provider == "jev"
        assert result.model_name == "Jev (jev-test)"
        assert result.boxes[0]["x2"] == 40
        assert result.img_w == 200
