import pytest
from playwright.sync_api import sync_playwright

BASE_URL = "http://127.0.0.1:5500"


@pytest.fixture
def page():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        page = browser.new_page()

        yield page

        browser.close()
