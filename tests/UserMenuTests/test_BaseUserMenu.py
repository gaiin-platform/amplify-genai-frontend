# This file will contain all of the basic things in the User Menu.
# Making sure all the components are present thereeeeeeeeeeeeeee

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


class ThemeChangeTests(BaseTest):

    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=True)
        
    def user_menu_open(self):
        time.sleep(3)  # Time to load
        
        # id="userMenu"
        user_menu_button = self.wait.until(EC.element_to_be_clickable((By.ID, "userMenu")))
        self.assertTrue(user_menu_button, "User Menu Button should be initialized")

        user_menu_button.click()
        
        time.sleep(2)

    # ----------------- Test Presence in User Menu ------------------
    """This will test ensure all of the elements in the User Menu are present and clickable"""

    def test_presence_in_user_menu(self):
        
        time.sleep(3)
        
        self.user_menu_open()
        
        time.sleep(2)
        
        # All the expected IDs in the user menu
        element_ids = [
            "userName",
            "userEmail",
            "MonthToDateCostDisplay",
            "sharingCenter",
            "myDataFiles",
            "adminInterface",
            "userCostInterface",
            "settingsInterface",
            "sendFeedbackInterface",
            "logout",
        ]

        # Check presence of each element
        for element_id in element_ids:
            elem = self.wait.until(EC.presence_of_element_located((By.ID, element_id)))
            self.assertTrue(elem, f"{element_id} should be present in the user menu")
            time.sleep(0.25)
            
        try:
            dark_mode_label = self.wait.until(EC.presence_of_element_located((By.ID, "switchTodarkMode")))
            self.assertTrue(dark_mode_label, "In light mode, switch to dark mode is present")
        except:
            light_mode_label = self.wait.until(EC.presence_of_element_located((By.ID, "switchTolightMode")))
            self.assertTrue(light_mode_label, "In dark mode, switch to light mode is present")
            
        time.sleep(1)

        # Check and click the close button
        close_button = self.wait.until(EC.element_to_be_clickable((By.ID, "closeUserMenu")))
        self.assertTrue(close_button, "Close button should be present")
        close_button.click()

        time.sleep(2)
        
        

if __name__ == "__main__":
    unittest.main(verbosity=2)
