from __future__ import annotations

from pathlib import Path

from app.core.config import hf_repo_cache_dir


def test_hf_repo_cache_dir_uses_hf_home(monkeypatch, tmp_path):
    monkeypatch.delenv("HF_HUB_CACHE", raising=False)
    monkeypatch.setenv("HF_HOME", str(tmp_path))
    assert hf_repo_cache_dir("facebook/sam3") == tmp_path / "hub" / "models--facebook--sam3"


def test_hf_repo_cache_dir_uses_hf_hub_cache(monkeypatch, tmp_path):
    monkeypatch.setenv("HF_HUB_CACHE", str(tmp_path / "hub-cache"))
    monkeypatch.setenv("HF_HOME", str(tmp_path / "ignored"))
    assert hf_repo_cache_dir("facebook/sam3") == (tmp_path / "hub-cache" / "models--facebook--sam3")


def test_hf_repo_cache_dir_default(monkeypatch, tmp_path):
    monkeypatch.delenv("HF_HUB_CACHE", raising=False)
    monkeypatch.delenv("HF_HOME", raising=False)
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: tmp_path))
    assert hf_repo_cache_dir("org/model") == (
        tmp_path / ".cache" / "huggingface" / "hub" / "models--org--model"
    )
