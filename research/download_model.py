"""Reproduce the exact model snapshot recorded in configs/models.json."""
import json
from pathlib import Path
from huggingface_hub import HfApi,snapshot_download
r=Path(__file__).parent
m=json.loads((r/'configs/models.json').read_text())['minilm']
info=HfApi().model_info(m['id'],revision=m['revision'])
assert info.cardData['license']=='apache-2.0'
snapshot_download(m['id'],revision=m['revision'],local_dir=r/'models/minilm',allow_patterns=['*.json','*.txt','*.model','model.safetensors','README.md','LICENSE'])
