"""Integration tests for the ONCafe Supabase REST API.

These tests are opt-in because the CRUD test creates and deletes temporary rows.
Run them only against a dedicated Supabase test project, never production.
"""
import json
import os
import uuid
from dataclasses import dataclass
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

import pytest


@dataclass
class ApiResponse:
    status: int
    data: object


class SupabaseRestClient:
    """Small stdlib-only client for Supabase Auth and PostgREST endpoints."""

    def __init__(self, project_url, api_key, access_token=None):
        self.project_url = project_url.rstrip("/")
        self.api_key = api_key
        self.access_token = access_token

    def request(self, method, path, payload=None, prefer=None):
        headers = {
            "apikey": self.api_key,
            "Accept": "application/json",
        }
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        if payload is not None:
            headers["Content-Type"] = "application/json"
        if prefer:
            headers["Prefer"] = prefer

        body = None if payload is None else json.dumps(payload).encode("utf-8")
        request = Request(
            f"{self.project_url}{path}",
            data=body,
            headers=headers,
            method=method,
        )

        try:
            with urlopen(request, timeout=10) as response:
                raw_body = response.read().decode("utf-8")
                return ApiResponse(response.status, _decode_body(raw_body))
        except HTTPError as error:
            raw_body = error.read().decode("utf-8")
            return ApiResponse(error.code, _decode_body(raw_body))


def _decode_body(raw_body):
    if not raw_body:
        return None
    try:
        return json.loads(raw_body)
    except json.JSONDecodeError:
        return raw_body


def _required_environment():
    names = (
        "ONCAFE_TEST_SUPABASE_URL",
        "ONCAFE_TEST_SUPABASE_ANON_KEY",
        "ONCAFE_TEST_STAFF_EMAIL",
        "ONCAFE_TEST_STAFF_PASSWORD",
    )
    missing = [name for name in names if not os.getenv(name)]
    return missing


@pytest.fixture(scope="module")
def api_clients():
    if os.getenv("ONCAFE_RUN_SUPABASE_API_TESTS") != "1":
        pytest.skip(
            "API integration tests are opt-in. Set ONCAFE_RUN_SUPABASE_API_TESTS=1."
        )

    missing = _required_environment()
    if missing:
        pytest.skip("Missing environment variables: " + ", ".join(missing))

    project_url = os.environ["ONCAFE_TEST_SUPABASE_URL"]
    anon_key = os.environ["ONCAFE_TEST_SUPABASE_ANON_KEY"]
    anonymous_client = SupabaseRestClient(project_url, anon_key)

    login = anonymous_client.request(
        "POST",
        "/auth/v1/token?grant_type=password",
        {
            "email": os.environ["ONCAFE_TEST_STAFF_EMAIL"],
            "password": os.environ["ONCAFE_TEST_STAFF_PASSWORD"],
        },
    )
    assert login.status == 200, (
        "Không đăng nhập được tài khoản test. "
        f"HTTP {login.status}: {login.data}"
    )
    assert isinstance(login.data, dict) and login.data.get("access_token"), (
        "Supabase Auth không trả về access_token hợp lệ."
    )

    authenticated_client = SupabaseRestClient(
        project_url,
        anon_key,
        login.data["access_token"],
    )
    return {
        "anonymous": anonymous_client,
        "authenticated": authenticated_client,
    }


def test_supabase_rest_connection_returns_products(api_clients):
    """GET: verify that the authenticated test account can read products."""
    response = api_clients["authenticated"].request(
        "GET",
        "/rest/v1/products?" + urlencode(
            {"select": "id,name,price", "limit": "5"}
        ),
    )

    assert response.status == 200, response.data
    assert isinstance(response.data, list)


def test_supabase_rest_rejects_write_without_staff_login(api_clients):
    """RLS/grants should prevent an anonymous client from inserting products."""
    response = api_clients["anonymous"].request(
        "POST",
        "/rest/v1/products",
        {
            "name": "ONCafe API unauthorized test",
            "price": 1000,
            "quantity": 1,
            "is_available": True,
            "category_id": -1,
        },
        prefer="return=representation",
    )

    assert response.status in (401, 403), (
        "API không từ chối thao tác ghi chưa xác thực như dự kiến. "
        f"HTTP {response.status}: {response.data}"
    )


def test_supabase_products_post_get_patch_delete_and_invalid_data(api_clients):
    """Exercise a complete CRUD lifecycle and reject a malformed numeric value."""
    client = api_clients["authenticated"]
    suffix = uuid.uuid4().hex[:12]
    category_name = f"__api_test_category_{suffix}"
    product_name = f"__api_test_product_{suffix}"
    category_id = None
    product_id = None

    try:
        # Create a temporary category first, as ProductRepository does.
        category_response = client.request(
            "POST",
            "/rest/v1/categories",
            {"name": category_name},
            prefer="return=representation",
        )
        assert category_response.status == 201, category_response.data
        assert isinstance(category_response.data, list) and category_response.data
        category_id = category_response.data[0]["id"]

        # POST with a non-numeric price must be rejected by PostgreSQL/PostgREST.
        invalid_response = client.request(
            "POST",
            "/rest/v1/products",
            {
                "name": product_name,
                "price": "not-a-number",
                "category_id": category_id,
                "quantity": 2,
                "is_available": True,
            },
            prefer="return=representation",
        )
        assert invalid_response.status == 400, (
            "API phải từ chối giá không phải số. "
            f"HTTP {invalid_response.status}: {invalid_response.data}"
        )

        # POST: create a temporary product.
        create_response = client.request(
            "POST",
            "/rest/v1/products",
            {
                "name": product_name,
                "price": 31000,
                "category_id": category_id,
                "quantity": 4,
                "is_available": True,
            },
            prefer="return=representation",
        )
        assert create_response.status == 201, create_response.data
        assert isinstance(create_response.data, list) and create_response.data
        product_id = create_response.data[0]["id"]
        assert create_response.data[0]["name"] == product_name

        # GET: retrieve the row just created.
        get_response = client.request(
            "GET",
            f"/rest/v1/products?id=eq.{product_id}&select=id,name,price,quantity",
        )
        assert get_response.status == 200, get_response.data
        assert len(get_response.data) == 1
        assert get_response.data[0]["price"] == 31000

        # PATCH: update the row. PostgREST uses PATCH for record updates.
        update_response = client.request(
            "PATCH",
            f"/rest/v1/products?id=eq.{product_id}",
            {"name": product_name + "_updated", "price": 35000, "quantity": 3},
            prefer="return=representation",
        )
        assert update_response.status == 200, update_response.data
        assert update_response.data[0]["name"] == product_name + "_updated"
        assert update_response.data[0]["price"] == 35000
        assert update_response.data[0]["quantity"] == 3

        # DELETE: remove the temporary row.
        delete_response = client.request(
            "DELETE",
            f"/rest/v1/products?id=eq.{product_id}",
            prefer="return=representation",
        )
        assert delete_response.status == 200, delete_response.data
        assert delete_response.data and delete_response.data[0]["id"] == product_id
        product_id = None
    finally:
        # Best-effort cleanup so failed assertions do not leave test data behind.
        if product_id is not None:
            client.request("DELETE", f"/rest/v1/products?id=eq.{product_id}")
        if category_id is not None:
            client.request("DELETE", f"/rest/v1/categories?id=eq.{category_id}")


def test_supabase_api_connection_failure_is_reported():
    """A refused connection must surface as a network error, not a fake success."""
    unavailable_client = SupabaseRestClient(
        "http://127.0.0.1:1",
        "test-key",
    )

    with pytest.raises(URLError):
        unavailable_client.request("GET", "/rest/v1/products?select=id&limit=1")
