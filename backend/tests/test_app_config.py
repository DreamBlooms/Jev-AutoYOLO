from __future__ import annotations

import pytest
from fastapi import HTTPException

from app.api.routes.train import create_training_job
from app.core.config import settings
from app.main import app_config
from app.schemas.train import TrainRequest
from app.services import runtime_config


def test_app_config_annotation_only(monkeypatch):
    monkeypatch.setattr(settings, "annotation_only", True)
    monkeypatch.setattr(settings, "device", "cpu")
    monkeypatch.setattr(runtime_config, "available_devices", lambda: ["cpu"])

    config = app_config()
    assert config["annotationOnly"] is True
    assert config["trainingEnabled"] is False
    assert config["validationEnabled"] is True
    assert config["samEnabled"] is True
    assert config["device"] == "cpu"
    assert config["gpuAvailable"] is False


def test_app_config_full_mode(monkeypatch):
    monkeypatch.setattr(settings, "annotation_only", False)
    monkeypatch.setattr(settings, "device", "cuda")
    monkeypatch.setattr(runtime_config, "available_devices", lambda: ["cpu", "cuda"])

    config = app_config()
    assert config["annotationOnly"] is False
    assert config["trainingEnabled"] is True
    assert config["device"] == "cuda"
    assert config["gpuAvailable"] is True


def test_training_is_rejected_in_annotation_only_mode(monkeypatch):
    monkeypatch.setattr(settings, "annotation_only", True)
    body = TrainRequest(detection_ids=["00000000-0000-0000-0000-000000000000"])
    with pytest.raises(HTTPException) as exc:
        create_training_job(body, db=None, request_id="-")
    assert exc.value.status_code == 403


def test_available_devices_always_contains_cpu():
    assert "cpu" in runtime_config.available_devices()


def test_switch_to_unavailable_gpu_is_rejected(monkeypatch):
    monkeypatch.setattr(runtime_config, "available_devices", lambda: ["cpu"])
    with pytest.raises(ValueError, match="CUDA is not available"):
        runtime_config.set_inference_device("cuda")


def test_switch_to_cpu_unloads_models(monkeypatch):
    import app.services.locate_anything as locate
    import app.services.sam2_service as sam2
    import app.services.sam3_client as sam3

    monkeypatch.setattr(runtime_config, "available_devices", lambda: ["cpu"])
    monkeypatch.setattr(locate, "is_model_loaded", lambda: False)
    monkeypatch.setattr(sam2, "is_sam_loaded", lambda: False)
    monkeypatch.setattr(sam3, "is_sam3_running", lambda: False)
    monkeypatch.setattr(settings, "device", "cuda")

    config = runtime_config.set_inference_device("cpu")
    assert config["device"] == "cpu"
    assert config["devicePreference"] == "cpu"


def test_provider_specific_jev_model(monkeypatch):
    monkeypatch.setattr(settings, "jev_provider", "openrouter")
    monkeypatch.setattr(settings, "jev_model", "")
    monkeypatch.setattr(settings, "openrouter_jev_model", "~typesafe/jev-1.14")
    assert settings.resolved_jev_model == "~typesafe/jev-1.14"

    monkeypatch.setattr(settings, "jev_provider", "typesafe")
    monkeypatch.setattr(settings, "typesafe_jev_model", "jev-1.14.0")
    assert settings.resolved_jev_model == "jev-1.14.0"

    monkeypatch.setattr(settings, "typesafe_jev_model", "")
    monkeypatch.setattr(settings, "jev_model", "shared-model")
    assert settings.resolved_jev_model == "shared-model"
