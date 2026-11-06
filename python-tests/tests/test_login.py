import pytest
from urllib.parse import parse_qs, urlparse

from conftest import BASE_URL


def open_login_page(page, query=""):
    page.goto(f"{BASE_URL}/pages/auth/login.html{query}")
    page.locator("#loginForm").wait_for()


def mock_successful_login(page, role):
    page.route(
        "**/auth/v1/token**",
        lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='''{
                "access_token": "fake-access-token",
                "token_type": "bearer",
                "expires_in": 3600,
                "refresh_token": "fake-refresh-token",
                "user": {
                    "id": "test-user-id",
                    "email": "test@example.com",
                    "role": "authenticated"
                }
            }'''
        )
    )
    page.route(
        "**/rest/v1/profiles**",
        lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body=f'''{{
                "id": "test-user-id",
                "full_name": "Test User",
                "role": "{role}"
            }}'''
        )
    )


def test_login_page_displays_correct_title(page):
    open_login_page(page)

    assert page.title() == "Đăng nhập - ONCafe"
    assert page.locator("#loginTitle").inner_text() == "Đăng nhập"


def test_login_form_has_required_fields(page):
    open_login_page(page)

    assert page.locator("#email").is_visible()
    assert page.locator("#password").is_visible()
    assert page.locator("#togglePassword").is_visible()
    assert page.locator("#forgotPassword").is_visible()
    assert page.locator('button[type="submit"]').is_visible()


def test_toggle_password_visibility(page):
    open_login_page(page)

    password = page.locator("#password")
    toggle = page.locator("#togglePassword")

    assert password.get_attribute("type") == "password"

    toggle.click()

    assert password.get_attribute("type") == "text"
    assert toggle.inner_text() == "Ẩn"

    toggle.click()

    assert password.get_attribute("type") == "password"
    assert toggle.inner_text() == "Hiện"


def test_empty_email_shows_validation_error(page):
    open_login_page(page)

    page.locator("#password").fill("password123")
    page.locator('button[type="submit"]').click()

    email_error = page.locator('[data-validation-error="email"]')

    assert email_error.is_visible()
    assert email_error.inner_text() == "Vui lòng điền vào trường này."
    assert page.locator("#email").get_attribute("aria-invalid") == "true"


def test_invalid_email_shows_validation_error(page):
    open_login_page(page)

    page.locator("#email").fill("email-khong-hop-le")
    page.locator("#password").fill("password123")
    page.locator('button[type="submit"]').click()

    email_error = page.locator('[data-validation-error="email"]')

    assert email_error.is_visible()
    assert email_error.inner_text() == "Vui lòng nhập địa chỉ email hợp lệ."


def test_empty_password_shows_validation_error(page):
    open_login_page(page)

    page.locator("#email").fill("test@example.com")
    page.locator('button[type="submit"]').click()

    password_error = page.locator('[data-validation-error="password"]')

    assert password_error.is_visible()
    assert password_error.inner_text() == "Vui lòng điền vào trường này."


def test_validation_error_clears_after_input(page):
    open_login_page(page)

    email = page.locator("#email")

    page.locator("#password").fill("password123")
    page.locator('button[type="submit"]').click()

    assert page.locator('[data-validation-error="email"]').is_visible()

    email.fill("test@example.com")

    assert page.locator('[data-validation-error="email"]').count() == 0
    assert email.get_attribute("aria-invalid") is None

def test_wrong_password_shows_error_message(page):
    # Giả lập Supabase từ chối đăng nhập
    page.route(
        "**/auth/v1/token**",
        lambda route: route.fulfill(
            status=400,
            content_type="application/json",
            body='{"code":"invalid_credentials","message":"Invalid login credentials"}'
        )
    )

    open_login_page(page)

    page.locator("#email").fill("test@example.com")
    page.locator("#password").fill("wrong-password")
    page.locator('button[type="submit"]').click()

    message = page.locator("#loginMessage")

    page.wait_for_function(
        """() => document.querySelector("#loginMessage")
        .textContent.includes("Invalid login credentials")"""
    )

    assert message.is_visible()
    assert "Invalid login credentials" in message.inner_text()
    assert message.get_attribute("data-state") == "error"

@pytest.mark.parametrize("role", ["admin", "cashier", "seller"])
def test_staff_login_success_redirects_to_dashboard(page, role):
    mock_successful_login(page, role)

    open_login_page(page)

    page.locator("#email").fill("test@example.com")
    page.locator("#password").fill("fake-password")
    page.locator('button[type="submit"]').click()

    page.wait_for_url("**/pages/admin/dashboard.html")

    assert page.url.endswith("/pages/admin/dashboard.html")


@pytest.mark.parametrize(
    ("redirect", "expected_page"),
    [
        ("", "home.html"),
        ("menu", "menu.html"),
        ("my-orders", "my-orders.html"),
        ("profile", "profile.html"),
        ("unknown", "home.html"),
    ],
)
def test_customer_login_redirects_to_requested_page(page, redirect, expected_page):
    mock_successful_login(page, "customer")
    open_login_page(page, f"?redirect={redirect}")

    page.locator("#email").fill("test@example.com")
    page.locator("#password").fill("fake-password")
    page.locator('button[type="submit"]').click()

    page.wait_for_url(f"**/pages/customer/{expected_page}")

    assert page.url.endswith(f"/pages/customer/{expected_page}")


def test_forgot_password_rejects_invalid_email(page):
    recovery_requests = []
    page.on(
        "request",
        lambda request: recovery_requests.append(request)
        if "/auth/v1/recover" in request.url
        else None,
    )
    open_login_page(page)

    page.locator("#email").fill("invalid-email")
    page.locator("#forgotPassword").click()

    email_error = page.locator('[data-validation-error="email"]')
    assert email_error.is_visible()
    assert email_error.inner_text() == "Vui lòng nhập email hợp lệ trước khi đặt lại mật khẩu."
    assert recovery_requests == []


def test_forgot_password_shows_success_after_request(page):
    page.route(
        "**/auth/v1/recover**",
        lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body="{}",
        ),
    )
    open_login_page(page)

    page.locator("#email").fill("test@example.com")
    page.locator("#forgotPassword").click()

    message = page.locator("#loginMessage")
    page.wait_for_function(
        """() => document.querySelector("#loginMessage")
        .textContent.includes("bạn sẽ nhận được hướng dẫn đặt lại mật khẩu")"""
    )

    assert message.get_attribute("data-state") == "success"
    assert "bạn sẽ nhận được hướng dẫn đặt lại mật khẩu" in message.inner_text()


def test_forgot_password_sends_email_and_reset_redirect(page):
    recovery_requests = []

    def handle_recovery(route):
        recovery_requests.append(route.request)
        route.fulfill(
            status=200,
            content_type="application/json",
            body="{}",
        )

    page.route("**/auth/v1/recover**", handle_recovery)
    open_login_page(page)

    page.locator("#email").fill("  test@example.com  ")
    page.locator("#forgotPassword").click()
    page.wait_for_function(
        """() => document.querySelector("#loginMessage")
        .textContent.includes("bạn sẽ nhận được hướng dẫn đặt lại mật khẩu")"""
    )

    assert len(recovery_requests) == 1
    request = recovery_requests[0]
    assert request.post_data_json["email"] == "test@example.com"
    assert parse_qs(urlparse(request.url).query)["redirect_to"] == [
        f"{BASE_URL}/pages/auth/reset-password.html"
    ]


def test_forgot_password_shows_server_error(page):
    page.route(
        "**/auth/v1/recover**",
        lambda route: route.fulfill(
            status=500,
            content_type="application/json",
            body='{"message":"Recovery service unavailable"}',
        ),
    )
    open_login_page(page)

    page.locator("#email").fill("test@example.com")
    page.locator("#forgotPassword").click()

    message = page.locator("#loginMessage")
    page.wait_for_function(
        """() => document.querySelector("#loginMessage")
        .textContent.includes("Recovery service unavailable")"""
    )

    assert message.get_attribute("data-state") == "error"
    assert "Recovery service unavailable" in message.inner_text()


def test_expired_recovery_error_at_root_opens_reset_password_page(page):
    page.goto(
        f"{BASE_URL}/#error=access_denied&error_code=otp_expired"
        "&error_description=Email+link+is+invalid+or+has+expired"
    )

    page.wait_for_url("**/pages/auth/reset-password.html#error=access_denied&error_code=otp_expired*")

    assert page.locator("#resetPasswordForm button[type='submit']").is_disabled()
    assert "đã hết hạn hoặc đã được sử dụng" in page.locator("#resetPasswordMessage").inner_text()


def test_expired_recovery_link_shows_actionable_message(page):
    page.goto(
        f"{BASE_URL}/pages/auth/reset-password.html"
        "#error=access_denied&error_code=otp_expired"
    )

    message = page.locator("#resetPasswordMessage")
    page.wait_for_function(
        """() => document.querySelector("#resetPasswordMessage")
        .textContent.includes("đã hết hạn hoặc đã được sử dụng")"""
    )

    assert message.get_attribute("data-state") == "error"
    assert page.locator("#resetPasswordForm button[type='submit']").is_disabled()


def test_profile_lookup_error_is_shown_without_redirect(page):
    page.route(
        "**/auth/v1/token**",
        lambda route: route.fulfill(
            status=200,
            content_type="application/json",
            body='''{
                "access_token": "fake-access-token",
                "token_type": "bearer",
                "expires_in": 3600,
                "refresh_token": "fake-refresh-token",
                "user": {
                    "id": "test-user-id",
                    "email": "test@example.com",
                    "role": "authenticated"
                }
            }'''
        )
    )
    page.route(
        "**/rest/v1/profiles**",
        lambda route: route.fulfill(
            status=500,
            content_type="application/json",
            body='{"message":"Profile service unavailable"}',
        )
    )
    open_login_page(page)
    login_url = page.url

    page.locator("#email").fill("test@example.com")
    page.locator("#password").fill("fake-password")
    page.locator('button[type="submit"]').click()

    message = page.locator("#loginMessage")
    page.wait_for_function(
        """() => document.querySelector("#loginMessage")
        .textContent.includes("Profile service unavailable")"""
    )

    assert page.url == login_url
    assert message.get_attribute("data-state") == "error"
    assert "Profile service unavailable" in message.inner_text()
