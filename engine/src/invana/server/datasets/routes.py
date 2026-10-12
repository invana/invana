"""Paths for datasets, all under ``/api/v1/datasets`` — above Graphs.

=================================================  ==========================================
GET · POST ``""``                                  the catalogue · create (no version yet)
GET · PATCH ``/{publisher}/{name}``                detail · metadata (never a version)
GET · POST ``/{publisher}/{name}/versions``        versions · mint the next one
GET ``/{publisher}/{name}/versions/{v}``           one version
GET ``/{publisher}/{name}/versions/{v}/records``   its records, by key
POST ``/{publisher}/{name}/versions/{v}/retract``  mark it withdrawn (install Admin)
GET ``/{publisher}/{name}/versions/{v}/used``      the bindings and versions that cite it
GET ``/{publisher}/{name}/records/{key}``          one record (current version by default)
GET ``/{publisher}/{name}/records/{key}/history``  the record's change log
GET ``/{publisher}/{name}/history``                the dataset's versions, as the change log
GET ``/{publisher}/{name}/history/compare``        two of its versions
GET · POST ``/{publisher}/{name}/standards``       the standards it claims · claim one
DELETE ``/{publisher}/{name}/standards/{p}/{n}``   stop claiming one
GET ``/{publisher}/{name}/versions/{v}/conformance`` one version scored against each claim
=================================================  ==========================================

A Graph binds a version under ``/api/v1/u/{username}/{graphSlug}/dataset-bindings``
(``GET`` its bindings · ``POST`` bind one), tag ``datasets`` as well.

Defines no function — path to view, nothing else.
"""

from __future__ import annotations

from fastapi import APIRouter, status

from invana.activity.schemas import ChangeCompare, RecordHistory
from invana.apps.datasets.schemas import (
    ConformanceListResponse,
    DatasetBindingListResponse,
    DatasetBindingRead,
    DatasetListResponse,
    DatasetRead,
    DatasetRecordPage,
    DatasetRecordRead,
    DatasetStandardListResponse,
    DatasetStandardRead,
    DatasetVersionListResponse,
    DatasetVersionRead,
    DatasetVersionUsage,
    RecordChangeLog,
)
from invana.server.datasets import views

datasets_router = APIRouter(prefix="/api/v1/datasets", tags=["datasets"])

_ONE = "/{publisher}/{name}"

datasets_router.get("", response_model=DatasetListResponse)(views.list_datasets)
datasets_router.post("", response_model=DatasetRead, status_code=status.HTTP_201_CREATED)(views.create_dataset)
datasets_router.get(_ONE, response_model=DatasetRead)(views.get_dataset)
datasets_router.patch(_ONE, response_model=DatasetRead)(views.update_dataset)
datasets_router.get(f"{_ONE}/versions", response_model=DatasetVersionListResponse)(views.list_versions)
datasets_router.post(f"{_ONE}/versions", response_model=DatasetVersionRead, status_code=status.HTTP_201_CREATED)(
    views.publish_version
)
datasets_router.get(f"{_ONE}/versions/{{version}}", response_model=DatasetVersionRead)(views.get_version)
datasets_router.get(f"{_ONE}/versions/{{version}}/records", response_model=DatasetRecordPage)(views.list_records)
datasets_router.post(f"{_ONE}/versions/{{version}}/retract", response_model=DatasetVersionRead)(views.retract_version)
datasets_router.get(f"{_ONE}/versions/{{version}}/used", response_model=DatasetVersionUsage)(views.version_used)
datasets_router.get(f"{_ONE}/records/{{key}}", response_model=DatasetRecordRead)(views.get_record)
datasets_router.get(f"{_ONE}/records/{{key}}/history", response_model=RecordChangeLog)(views.record_history)
datasets_router.get(f"{_ONE}/history", response_model=RecordHistory)(views.dataset_history)
datasets_router.get(f"{_ONE}/history/compare", response_model=ChangeCompare)(views.compare_dataset_versions)
datasets_router.get(f"{_ONE}/standards", response_model=DatasetStandardListResponse)(views.list_standards)
datasets_router.post(f"{_ONE}/standards", response_model=DatasetStandardRead, status_code=status.HTTP_201_CREATED)(
    views.attach_standard
)
datasets_router.delete(
    f"{_ONE}/standards/{{standard_publisher}}/{{standard_name}}", status_code=status.HTTP_204_NO_CONTENT
)(views.detach_standard)
datasets_router.get(f"{_ONE}/versions/{{version}}/conformance", response_model=ConformanceListResponse)(
    views.version_conformance
)

dataset_bindings_router = APIRouter(prefix="/api/v1/u/{username}/{graphSlug}/dataset-bindings", tags=["datasets"])

dataset_bindings_router.get("", response_model=DatasetBindingListResponse)(views.list_bindings)
dataset_bindings_router.post("", response_model=DatasetBindingRead, status_code=status.HTTP_201_CREATED)(
    views.bind_dataset
)
