import unittest
import time
import os
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.common.exceptions import (
    UnexpectedAlertPresentException,
    NoSuchElementException,
)
from selenium.common.exceptions import TimeoutException
from selenium.common.exceptions import NoAlertPresentException
from selenium.webdriver.common.keys import Keys
from tests.base_test import BaseTest


class LogoutTests(BaseTest):

    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=True)

    # ----------------- Test Logout Button ------------------
    """This will test the logout button and ensure the user is logged out"""

    def test_logout(self):
        time.sleep(3)  # Time to load
        
        # id="userMenu"
        user_menu_button = self.wait.until(EC.element_to_be_clickable((By.ID, "userMenu")))
        self.assertTrue(user_menu_button, "Logout Button should be initialized")

        user_menu_button.click()
        
        time.sleep(2)

        # Click the Logout Button
        logout_button = self.wait.until(EC.element_to_be_clickable((By.ID, "logout")))
        self.assertTrue(logout_button, "Logout Button should be initialized")

        logout_button.click()

        time.sleep(10)  # Time to load Logout area

        # Ensure login button is visible
        login_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "loginButton"))
        )
        self.assertTrue(login_button, "Login Button should be initialized")


if __name__ == "__main__":
    unittest.main(verbosity=2)
