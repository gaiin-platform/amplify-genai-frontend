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
        
    def send_message(self, chat_name, message):
        # Locate all elements with the ID 'chatName'
        chat_name_elements = self.wait.until(EC.presence_of_all_elements_located((By.ID, "chatName")))
        self.assertTrue(chat_name_elements, "Chat name elements should be initialized")
        
        time.sleep(2)
        
        # Find the element with chat name
        chat = next((el for el in chat_name_elements if el.text == chat_name), None)
        self.assertIsNotNone(chat, "Chat button should be present")
        chat_click = chat.find_element(By.XPATH, "./ancestor::button")
        button_id = chat_click.get_attribute("id")
        self.assertEqual(button_id, "chatClick", "Button should be called chatClick")
        chat_click.click()
        # Locate the chatbar to input in messageChatInputText
        chat_input_bar = self.wait.until(EC.presence_of_element_located((By.ID, "messageChatInputText")))
        self.assertTrue(chat_input_bar, "Chat bar input should be initialized")
        chat_input_bar.send_keys(message)
        
        time.sleep(2)
        
        # Locate the send message button
        chat_send_message = self.wait.until(EC.presence_of_element_located((By.ID, "sendMessage")))
        self.assertTrue(chat_send_message, "Send message button should be initialized")
        chat_send_message.click()
        time.sleep(15)

    # ----------------- Test Theme Change Button ------------------
    """This will test the change theme button in the User Menu and ensure it switches
       between light and dark accordingly"""

    def test_change_theme(self):
        
        time.sleep(3)
        
        self.user_menu_open()
        
        time.sleep(2)
        
        light_mode = None
        
        try:
            dark_mode_label = self.wait.until(EC.presence_of_element_located((By.ID, "switchTodarkMode")))
            self.assertTrue(dark_mode_label, "In light mode, switch to dark mode is present")
            light_mode = True
        except:
            light_mode_label = self.wait.until(EC.presence_of_element_located((By.ID, "switchTolightMode")))
            self.assertTrue(light_mode_label, "In dark mode, switch to light mode is present")
            light_mode = False
            
        time.sleep(1)
        
        if light_mode:
            dark_mode_label = self.wait.until(EC.presence_of_element_located((By.ID, "switchTodarkMode")))
            self.assertTrue(dark_mode_label, "In light mode, switch to dark mode is present")
            dark_mode_label.click()
            light_mode = False
        else:
            light_mode_label = self.wait.until(EC.presence_of_element_located((By.ID, "switchTolightMode")))
            self.assertTrue(light_mode_label, "In dark mode, switch to light mode is present")
            light_mode_label.click()
            light_mode = True
            
        time.sleep(3)
        
        # Switch back to original
        try:
            dark_mode_label = self.wait.until(EC.presence_of_element_located((By.ID, "switchTodarkMode")))
            self.assertTrue(dark_mode_label, "In light mode, switch to dark mode is present")
            dark_mode_label.click()
        except:
            light_mode_label = self.wait.until(EC.presence_of_element_located((By.ID, "switchTolightMode")))
            self.assertTrue(light_mode_label, "In dark mode, switch to light mode is present")
            light_mode_label.click()

        time.sleep(3)
        
    # ----------------- Test Color Scheme Change ------------------
    """This will test the buttons in the User Menu and ensure it switches
       between the different color themes accordingly"""

    def test_change_color_scheme(self):
        
        time.sleep(3)
        
        self.send_message("New Conversation", "Hello there... General Kenobi...")
        
        time.sleep(3)
        
        self.user_menu_open()
        
        time.sleep(2)
        
        color_scheme_button = self.wait.until(EC.element_to_be_clickable((By.ID, "High Contrast")))
        color_scheme_button.click()
        
        time.sleep(2)
        
        color_schemes = [
        "Warm Browns",
        "Blue & Green",
        "Purple & Pink",
        "Cool Grays",
        "Ocean Depths",
        "High Contrast"
        ]
        
        for scheme in color_schemes:
        
            # Find the button by ID
            color_scheme_button = self.wait.until(EC.element_to_be_clickable((By.ID, scheme)))
            
            # Verify initial class (not selected)
            initial_class = color_scheme_button.get_attribute("class")
            self.assertEqual(initial_class.strip(), "color-palette-option", "Button should start unselected")

            # Click it
            color_scheme_button.click()
            
            time.sleep(3)
            
            # Verify final class
            final_class = color_scheme_button.get_attribute("class")
            self.assertIn("color-palette-option selected", final_class, "Button should be selected after click")
            
            time.sleep(2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
