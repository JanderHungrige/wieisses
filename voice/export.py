"""Image build step: the Thorsten-Voice/Kokoro checkpoint -> ONNX model, style vectors, vocabulary.

Runs only in the Dockerfile's export stage, which has PyTorch; the runtime image gets the three
files and needs nothing but onnxruntime (doc 01, "Voice (Thorsten)").

    python export.py <dir with model.pth, config.json, thorsten.pt> <out dir>
"""

import json
import sys
import types

import numpy as np
import onnx
import torch

# kokoro/__init__ also imports its text pipeline, which needs misaki[en] and spaCy; the export
# only needs the model.
sys.modules["kokoro.pipeline"] = types.ModuleType("kokoro.pipeline")
sys.modules["kokoro.pipeline"].KPipeline = None
from kokoro.model import KModel, KModelForONNX  # noqa: E402


def main(source, out):
    with open(f"{source}/config.json", encoding="utf-8") as config_file:
        config = json.load(config_file)
    model = KModel(repo_id="hexgrad/Kokoro-82M", config=config, model=f"{source}/model.pth", disable_complex=True)
    wrapped = KModelForONNX(model.eval()).eval()
    sample = (torch.LongTensor([[0, *range(1, 49), 0]]), torch.zeros(1, 256), torch.tensor([1.0]))
    torch.onnx.export(
        wrapped,
        sample,
        f"{out}/kokoro-thorsten.onnx",
        input_names=["input_ids", "style", "speed"],
        output_names=["waveform", "duration"],
        dynamic_axes={"input_ids": {0: "batch", 1: "tokens"}, "style": {0: "batch"}, "speed": {0: "batch"}},
        opset_version=17,
        do_constant_folding=True,
        dynamo=False,
    )
    onnx.checker.check_model(f"{out}/kokoro-thorsten.onnx")
    styles = torch.load(f"{source}/thorsten.pt", map_location="cpu", weights_only=True)
    np.save(f"{out}/thorsten-styles.npy", styles.numpy().astype(np.float32))
    with open(f"{out}/vocab.json", "w", encoding="utf-8") as vocab_file:
        json.dump(config["vocab"], vocab_file, ensure_ascii=False)
    print("exported", tuple(styles.shape), len(config["vocab"]), "symbols")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
