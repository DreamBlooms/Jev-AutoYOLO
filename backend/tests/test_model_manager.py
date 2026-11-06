from __future__ import annotations

import pytest

from app.services import model_manager


def test_unknown_kind_is_rejected():
    with pytest.raises(ValueError, match="Unknown model kind"):
        model_manager.start_download("unknown")


def test_merge_prefers_active_download_state():
    model_manager._set(
        "vlm",
        state="downloading",
        stage="download",
        progress=20,
        error="",
        source="modelscope",
    )
    merged = model_manager.merge_status("vlm", {"state": "unloaded"})
    assert merged["state"] == "downloading"
    assert merged["progress"] == 20
    assert merged["source"] == "modelscope"


def test_merge_falls_back_to_worker_state():
    model_manager.reset("sam2")
    merged = model_manager.merge_status(
        "sam2", {"state": "loading", "stage": "gpu", "progress": 50, "error": ""}
    )
    assert merged["state"] == "loading"
    assert merged["progress"] == 50


def test_start_download_marks_state(monkeypatch):
    started = []

    def fake_run(kind):
        started.append(kind)

    monkeypatch.setattr(model_manager, "_run_download", fake_run)
    status = model_manager.start_download("sam2")
    assert status["state"] == "downloading"
    assert started == ["sam2"]


def test_reset_clears_state():
    model_manager._set("sam3", state="error", progress=0, error="boom")
    model_manager.reset("sam3")
    status = model_manager.get_status("sam3")
    assert status["state"] == "unloaded"
    assert status["error"] == ""


def test_start_download_skips_loaded_model(monkeypatch):
    called = []
    monkeypatch.setattr(model_manager, "_run_download", lambda kind: called.append(kind))
    model_manager._set("vlm", state="loaded", progress=100)
    status = model_manager.start_download("vlm")
    assert status["state"] == "loaded"
    assert called == []


def test_completeness_checks(tmp_path):
    vlm = tmp_path / "vlm"
    vlm.mkdir()
    (vlm / "config.json").write_text("{}")
    assert model_manager._vlm_complete(vlm) is False
    (vlm / "model.safetensors").write_bytes(b"x" * (1024 * 1024 + 1))
    assert model_manager._vlm_complete(vlm) is True

    sam2 = tmp_path / "sam2"
    sam2.mkdir()
    (sam2 / "sam2.1_hiera_base_plus.pt").write_bytes(b"x" * (1024 * 1024 + 1))
    assert model_manager._sam2_checkpoint(sam2) is not None

    sam3 = tmp_path / "sam3"
    sam3.mkdir()
    (sam3 / "config.json").write_text("{}")
    assert model_manager._sam3_complete(sam3) is False
    (sam3 / "model.safetensors").write_bytes(b"x" * 10)
    assert model_manager._sam3_complete(sam3) is True
