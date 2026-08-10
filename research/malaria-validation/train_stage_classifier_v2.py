from __future__ import annotations

import csv
import json
import math
import random
from collections import Counter
from pathlib import Path

import torch
from PIL import Image
from torch import nn
from torch.utils.data import (
    DataLoader,
    Dataset,
    WeightedRandomSampler,
)
from torchvision import transforms
from torchvision.models import (
    MobileNet_V3_Small_Weights,
    mobilenet_v3_small,
)


# ============================================================
# CONFIG
# ============================================================

SEED = 41

ROOT = Path(
    "research/malaria-validation"
)

DATA_ROOT = (
    ROOT
    / "data"
    / "stage-classifier-v2"
)

OUTPUT_ROOT = (
    ROOT
    / "outputs"
    / "stage-classifier-v2"
)

BEST_MODEL_PATH = (
    OUTPUT_ROOT
    / "stage-classifier-v2.pt"
)

SUMMARY_PATH = (
    OUTPUT_ROOT
    / "summary.json"
)

HISTORY_PATH = (
    OUTPUT_ROOT
    / "history.json"
)

CONFUSION_PATH = (
    OUTPUT_ROOT
    / "confusion_matrix.csv"
)

CLASS_NAMES = (
    "ring",
    "trophozoite",
    "schizont",
    "gametocyte",
)

EXPECTED_TRAIN = {
    "ring": 246,
    "trophozoite": 1091,
    "schizont": 132,
    "gametocyte": 94,
}

EXPECTED_VAL = {
    "ring": 107,
    "trophozoite": 382,
    "schizont": 47,
    "gametocyte": 50,
}

IMAGE_SIZE = 160
BATCH_SIZE = 32
EPOCHS = 20
LEARNING_RATE = 3e-4
WEIGHT_DECAY = 1e-4
PATIENCE = 5

SUPPORTED_IMAGES = {
    ".png",
    ".jpg",
    ".jpeg",
}


# ============================================================
# REPRODUCIBILITY
# ============================================================

random.seed(SEED)
torch.manual_seed(SEED)

generator = torch.Generator()
generator.manual_seed(SEED)


# ============================================================
# DATASET
# ============================================================

class StageDataset(Dataset):
    def __init__(
        self,
        split: str,
        transform,
    ):
        self.transform = transform

        self.samples: list[
            tuple[Path, int]
        ] = []

        self.targets: list[int] = []

        self.counts = Counter()

        split_root = (
            DATA_ROOT
            / split
        )

        for class_index, class_name in enumerate(
            CLASS_NAMES
        ):
            class_dir = (
                split_root
                / class_name
            )

            if not class_dir.exists():
                raise FileNotFoundError(
                    class_dir
                )

            files = sorted(
                path
                for path in class_dir.iterdir()
                if (
                    path.is_file()
                    and path.suffix.lower()
                    in SUPPORTED_IMAGES
                )
            )

            self.counts[
                class_name
            ] = len(files)

            for path in files:
                self.samples.append(
                    (
                        path,
                        class_index,
                    )
                )

                self.targets.append(
                    class_index
                )

    def __len__(self):
        return len(
            self.samples
        )

    def __getitem__(
        self,
        index: int,
    ):
        path, target = (
            self.samples[
                index
            ]
        )

        with Image.open(
            path
        ) as source:
            image = source.convert(
                "RGB"
            )

        image = self.transform(
            image
        )

        return (
            image,
            target,
        )


# ============================================================
# TRANSFORMS
# ============================================================

weights = (
    MobileNet_V3_Small_Weights.DEFAULT
)

normalization = transforms.Normalize(
    mean=weights.transforms().mean,
    std=weights.transforms().std,
)

train_transform = (
    transforms.Compose(
        [
            transforms.RandomResizedCrop(
                IMAGE_SIZE,
                scale=(
                    0.85,
                    1.0,
                ),
                ratio=(
                    0.90,
                    1.10,
                ),
            ),

            transforms.RandomHorizontalFlip(
                p=0.5
            ),

            transforms.RandomVerticalFlip(
                p=0.5
            ),

            transforms.RandomRotation(
                degrees=10
            ),

            transforms.ColorJitter(
                brightness=0.15,
                contrast=0.15,
                saturation=0.15,
                hue=0.02,
            ),

            transforms.ToTensor(),

            normalization,
        ]
    )
)

val_transform = (
    transforms.Compose(
        [
            transforms.Resize(
                (
                    IMAGE_SIZE,
                    IMAGE_SIZE,
                )
            ),

            transforms.ToTensor(),

            normalization,
        ]
    )
)


# ============================================================
# METRICS
# ============================================================

def metrics_from_confusion(
    confusion: list[
        list[int]
    ],
) -> dict:
    total = sum(
        sum(row)
        for row in confusion
    )

    correct = sum(
        confusion[index][index]
        for index in range(
            len(CLASS_NAMES)
        )
    )

    per_class = {}

    precision_values = []
    recall_values = []
    f1_values = []

    for index, class_name in enumerate(
        CLASS_NAMES
    ):
        tp = (
            confusion[index][index]
        )

        fn = (
            sum(
                confusion[index]
            )
            - tp
        )

        fp = (
            sum(
                confusion[row][index]
                for row in range(
                    len(CLASS_NAMES)
                )
            )
            - tp
        )

        precision = (
            tp / (tp + fp)
            if tp + fp > 0
            else 0.0
        )

        recall = (
            tp / (tp + fn)
            if tp + fn > 0
            else 0.0
        )

        f1 = (
            2
            * precision
            * recall
            / (
                precision
                + recall
            )
            if precision + recall > 0
            else 0.0
        )

        support = sum(
            confusion[index]
        )

        precision_values.append(
            precision
        )

        recall_values.append(
            recall
        )

        f1_values.append(
            f1
        )

        per_class[
            class_name
        ] = {
            "precision":
                precision,

            "recall":
                recall,

            "f1":
                f1,

            "support":
                support,

            "tp":
                tp,

            "fp":
                fp,

            "fn":
                fn,
        }

    return {
        "accuracy":
            correct / total
            if total
            else 0.0,

        "macro_precision":
            sum(
                precision_values
            )
            / len(
                precision_values
            ),

        "macro_recall":
            sum(
                recall_values
            )
            / len(
                recall_values
            ),

        "macro_f1":
            sum(
                f1_values
            )
            / len(
                f1_values
            ),

        "per_class":
            per_class,

        "confusion_matrix":
            confusion,
    }


# ============================================================
# EVALUATION
# ============================================================

def evaluate(
    model,
    loader,
    criterion,
    device,
):
    model.eval()

    total_loss = 0.0
    total_samples = 0

    confusion = [
        [
            0
            for _ in CLASS_NAMES
        ]
        for _ in CLASS_NAMES
    ]

    with torch.inference_mode():
        for images, labels in loader:
            images = images.to(
                device
            )

            labels = labels.to(
                device
            )

            logits = model(
                images
            )

            loss = criterion(
                logits,
                labels,
            )

            batch_size = (
                labels.size(0)
            )

            total_loss += (
                loss.item()
                * batch_size
            )

            total_samples += (
                batch_size
            )

            predictions = (
                logits.argmax(
                    dim=1
                )
            )

            for truth, prediction in zip(
                labels.cpu().tolist(),
                predictions.cpu().tolist(),
            ):
                confusion[
                    truth
                ][
                    prediction
                ] += 1

    metrics = (
        metrics_from_confusion(
            confusion
        )
    )

    metrics[
        "loss"
    ] = (
        total_loss
        / total_samples
    )

    return metrics


# ============================================================
# TRAIN
# ============================================================

def main():
    print(
        "=== STAGE CLASSIFIER V2 ==="
    )

    print(
        "Official test used: NO"
    )

    print(
        f"Image size: "
        f"{IMAGE_SIZE}"
    )

    print(
        f"Epochs: "
        f"{EPOCHS}"
    )

    OUTPUT_ROOT.mkdir(
        parents=True,
        exist_ok=True,
    )

    train_dataset = (
        StageDataset(
            "train",
            train_transform,
        )
    )

    val_dataset = (
        StageDataset(
            "val",
            val_transform,
        )
    )

    if dict(
        train_dataset.counts
    ) != EXPECTED_TRAIN:
        raise RuntimeError(
            "Unexpected training counts: "
            f"{dict(train_dataset.counts)}"
        )

    if dict(
        val_dataset.counts
    ) != EXPECTED_VAL:
        raise RuntimeError(
            "Unexpected validation counts: "
            f"{dict(val_dataset.counts)}"
        )

    print()
    print(
        "TRAIN COUNTS"
    )

    for class_name in (
        CLASS_NAMES
    ):
        print(
            f" {class_name:14s}: "
            f"{train_dataset.counts[class_name]}"
        )

    print()
    print(
        "VAL COUNTS"
    )

    for class_name in (
        CLASS_NAMES
    ):
        print(
            f" {class_name:14s}: "
            f"{val_dataset.counts[class_name]}"
        )

    # --------------------------------------------------------
    # Moderate imbalance correction
    #
    # sqrt inverse-frequency weighting.
    # Avoids aggressively duplicating rare
    # examples while reducing trophozoite
    # domination.
    # --------------------------------------------------------

    max_count = max(
        train_dataset.counts.values()
    )

    class_sampling_weights = {
        class_name:
            math.sqrt(
                max_count
                / train_dataset.counts[
                    class_name
                ]
            )
        for class_name in CLASS_NAMES
    }

    print()
    print(
        "SAMPLING WEIGHTS"
    )

    for class_name in (
        CLASS_NAMES
    ):
        print(
            f" {class_name:14s}: "
            f"{class_sampling_weights[class_name]:.4f}"
        )

    sample_weights = [
        class_sampling_weights[
            CLASS_NAMES[target]
        ]
        for target
        in train_dataset.targets
    ]

    sampler = (
        WeightedRandomSampler(
            weights=sample_weights,
            num_samples=len(
                train_dataset
            ),
            replacement=True,
            generator=generator,
        )
    )

    train_loader = (
        DataLoader(
            train_dataset,
            batch_size=BATCH_SIZE,
            sampler=sampler,
            num_workers=0,
        )
    )

    val_loader = (
        DataLoader(
            val_dataset,
            batch_size=BATCH_SIZE,
            shuffle=False,
            num_workers=0,
        )
    )

    device = torch.device(
        "cpu"
    )

    print()
    print(
        f"Device: {device}"
    )

    print()
    print(
        "Loading pretrained "
        "MobileNetV3-Small..."
    )

    model = (
        mobilenet_v3_small(
            weights=weights
        )
    )

    input_features = (
        model.classifier[
            3
        ].in_features
    )

    model.classifier[
        3
    ] = nn.Linear(
        input_features,
        len(
            CLASS_NAMES
        ),
    )

    model = model.to(
        device
    )

    criterion = (
        nn.CrossEntropyLoss(
            label_smoothing=0.05
        )
    )

    optimizer = (
        torch.optim.AdamW(
            model.parameters(),
            lr=LEARNING_RATE,
            weight_decay=WEIGHT_DECAY,
        )
    )

    scheduler = (
        torch.optim.lr_scheduler.ReduceLROnPlateau(
            optimizer,
            mode="max",
            factor=0.5,
            patience=2,
        )
    )

    best_macro_f1 = -1.0
    best_epoch = 0

    epochs_without_improvement = 0

    history = []

    # --------------------------------------------------------
    # TRAINING LOOP
    # --------------------------------------------------------

    for epoch in range(
        1,
        EPOCHS + 1,
    ):
        model.train()

        running_loss = 0.0
        correct = 0
        total = 0

        for images, labels in (
            train_loader
        ):
            images = images.to(
                device
            )

            labels = labels.to(
                device
            )

            optimizer.zero_grad(
                set_to_none=True
            )

            logits = model(
                images
            )

            loss = criterion(
                logits,
                labels,
            )

            loss.backward()

            optimizer.step()

            batch_size = (
                labels.size(0)
            )

            running_loss += (
                loss.item()
                * batch_size
            )

            predictions = (
                logits.argmax(
                    dim=1
                )
            )

            correct += (
                predictions
                .eq(labels)
                .sum()
                .item()
            )

            total += (
                batch_size
            )

        train_loss = (
            running_loss
            / total
        )

        train_accuracy = (
            correct
            / total
        )

        val_metrics = evaluate(
            model,
            val_loader,
            criterion,
            device,
        )

        macro_f1 = (
            val_metrics[
                "macro_f1"
            ]
        )

        scheduler.step(
            macro_f1
        )

        learning_rate = (
            optimizer
            .param_groups[0][
                "lr"
            ]
        )

        history_entry = {
            "epoch":
                epoch,

            "train_loss":
                train_loss,

            "train_accuracy":
                train_accuracy,

            "val_loss":
                val_metrics[
                    "loss"
                ],

            "val_accuracy":
                val_metrics[
                    "accuracy"
                ],

            "val_macro_precision":
                val_metrics[
                    "macro_precision"
                ],

            "val_macro_recall":
                val_metrics[
                    "macro_recall"
                ],

            "val_macro_f1":
                macro_f1,

            "learning_rate":
                learning_rate,
        }

        history.append(
            history_entry
        )

        print()
        print(
            f"Epoch "
            f"{epoch:02d}/"
            f"{EPOCHS}"
        )

        print(
            f" train loss: "
            f"{train_loss:.4f}"
        )

        print(
            f" train acc : "
            f"{train_accuracy:.4f}"
        )

        print(
            f" val loss  : "
            f"{val_metrics['loss']:.4f}"
        )

        print(
            f" val acc   : "
            f"{val_metrics['accuracy']:.4f}"
        )

        print(
            f" macro F1  : "
            f"{macro_f1:.4f}"
        )

        if (
            macro_f1
            > best_macro_f1
            + 1e-4
        ):
            best_macro_f1 = (
                macro_f1
            )

            best_epoch = (
                epoch
            )

            epochs_without_improvement = (
                0
            )

            torch.save(
                {
                    "model_state_dict":
                        model.state_dict(),

                    "architecture":
                        "mobilenet_v3_small",

                    "class_names":
                        list(
                            CLASS_NAMES
                        ),

                    "image_size":
                        IMAGE_SIZE,

                    "epoch":
                        epoch,

                    "val_macro_f1":
                        macro_f1,

                    "seed":
                        SEED,

                    "official_test_used":
                        False,
                },
                BEST_MODEL_PATH,
            )

            print(
                " NEW BEST MODEL"
            )

        else:
            epochs_without_improvement += (
                1
            )

        if (
            epochs_without_improvement
            >= PATIENCE
        ):
            print()
            print(
                "Early stopping."
            )
            break

    # --------------------------------------------------------
    # LOAD BEST MODEL
    # --------------------------------------------------------

    checkpoint = torch.load(
        BEST_MODEL_PATH,
        map_location=device,
        weights_only=False,
    )

    model.load_state_dict(
        checkpoint[
            "model_state_dict"
        ]
    )

    final_metrics = evaluate(
        model,
        val_loader,
        criterion,
        device,
    )

    # --------------------------------------------------------
    # CONFUSION MATRIX CSV
    # --------------------------------------------------------

    confusion = (
        final_metrics[
            "confusion_matrix"
        ]
    )

    with CONFUSION_PATH.open(
        "w",
        newline="",
        encoding="utf-8",
    ) as file:
        writer = csv.writer(
            file
        )

        writer.writerow(
            [
                "actual\\predicted",
                *CLASS_NAMES,
            ]
        )

        for index, class_name in enumerate(
            CLASS_NAMES
        ):
            writer.writerow(
                [
                    class_name,
                    *confusion[
                        index
                    ],
                ]
            )

    HISTORY_PATH.write_text(
        json.dumps(
            history,
            indent=2,
        ),
        encoding="utf-8",
    )

    summary = {
        "status":
            "COMPLETE",

        "model":
            "MobileNetV3-Small",

        "pretrained":
            "ImageNet",

        "official_test_used":
            False,

        "seed":
            SEED,

        "image_size":
            IMAGE_SIZE,

        "context_scale":
            1.8,

        "training_strategy":
            (
                "sqrt inverse-frequency "
                "weighted sampling"
            ),

        "best_epoch":
            best_epoch,

        "train_counts":
            dict(
                train_dataset.counts
            ),

        "val_counts":
            dict(
                val_dataset.counts
            ),

        "sampling_weights":
            class_sampling_weights,

        "validation": {
            "accuracy":
                final_metrics[
                    "accuracy"
                ],

            "macro_precision":
                final_metrics[
                    "macro_precision"
                ],

            "macro_recall":
                final_metrics[
                    "macro_recall"
                ],

            "macro_f1":
                final_metrics[
                    "macro_f1"
                ],

            "per_class":
                final_metrics[
                    "per_class"
                ],
        },

        "confusion_matrix":
            confusion,

        "best_model":
            str(
                BEST_MODEL_PATH.resolve()
            ),
    }

    SUMMARY_PATH.write_text(
        json.dumps(
            summary,
            indent=2,
        ),
        encoding="utf-8",
    )

    # --------------------------------------------------------
    # REPORT
    # --------------------------------------------------------

    print()
    print(
        "========================================"
    )

    print(
        "STAGE CLASSIFIER V2 RESULTS"
    )

    print(
        "========================================"
    )

    print(
        f"Best epoch: "
        f"{best_epoch}"
    )

    print(
        f"Accuracy:   "
        f"{final_metrics['accuracy']:.4f}"
    )

    print(
        f"Macro P:    "
        f"{final_metrics['macro_precision']:.4f}"
    )

    print(
        f"Macro R:    "
        f"{final_metrics['macro_recall']:.4f}"
    )

    print(
        f"Macro F1:   "
        f"{final_metrics['macro_f1']:.4f}"
    )

    print()
    print(
        "PER CLASS"
    )

    for class_name in (
        CLASS_NAMES
    ):
        metrics = (
            final_metrics[
                "per_class"
            ][
                class_name
            ]
        )

        print()
        print(
            f" {class_name}"
        )

        print(
            f"   P: "
            f"{metrics['precision']:.4f}"
        )

        print(
            f"   R: "
            f"{metrics['recall']:.4f}"
        )

        print(
            f"   F1:"
            f" {metrics['f1']:.4f}"
        )

        print(
            f"   support:"
            f" {metrics['support']}"
        )

    print()
    print(
        f"Best model: "
        f"{BEST_MODEL_PATH.resolve()}"
    )

    print(
        f"Summary: "
        f"{SUMMARY_PATH.resolve()}"
    )

    print(
        f"Confusion matrix: "
        f"{CONFUSION_PATH.resolve()}"
    )

    print()
    print(
        "OFFICIAL TEST USED: NO"
    )


if __name__ == "__main__":
    main()