import unittest
import time
import os
import re
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.common.exceptions import UnexpectedAlertPresentException, NoSuchElementException
from selenium.common.exceptions import TimeoutException
from selenium.common.exceptions import NoAlertPresentException
from selenium.webdriver.common.keys import Keys
from tests.base_test import BaseTest

class SelectEnabledFeaturesTests(BaseTest):

    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=True)

    # ----------------- Setup Test Data ------------------
    def drag_element(self, element, target_x, target_y):
        """Drags the element to the specified x and y position."""
        style = element.get_attribute("style")
        match = re.search(r"translate\((-?\d+\.?\d*)px, (-?\d+\.?\d*)px\)", style)
        
        if match:
            current_x, current_y = float(match.group(1)), float(match.group(2))
        else:
            current_x, current_y = 0, 0  # Default if no style found
        
        dx = target_x - current_x
        dy = target_y - current_y
        actions = ActionChains(self.driver)
        actions.click_and_hold(element).move_by_offset(dx, dy).release().perform()
        time.sleep(1)  # Allow movement to finish
        
        
    def find_top_y_value(self):
        """Finds the topmost Y value the draggable can reach and returns it."""
        time.sleep(3)
        draggable = self.wait.until(EC.presence_of_element_located((By.ID, "selectEnabledFeaturesDrag")))
        container = self.wait.until(EC.presence_of_element_located((By.ID, "chatScrollWindow")))
        container_rect = container.rect  # Bounding box of the container
        draggable_rect = draggable.rect  # Bounding box of the draggable element
        target_y = container_rect["y"]
        actions = ActionChains(self.driver)
        actions.click_and_hold(draggable).move_by_offset(0, target_y - draggable_rect["y"]).release().perform()
        new_style = draggable.get_attribute("style")
        match = re.search(r"translate\((-?\d+\.?\d*)px, (-?\d+\.?\d*)px\)", new_style)

        if match:
            new_y = float(match.group(2))
            # print(f"Top Y-Value Found: {new_y}")
            return new_y
        else:
            raise ValueError("Failed to extract final Y position")


    def find_far_x_value(self):
        """Finds the farthest right X value the draggable can reach and returns it."""
        time.sleep(3)
        draggable = self.wait.until(EC.presence_of_element_located((By.ID, "selectEnabledFeaturesDrag")))
        container = self.wait.until(EC.presence_of_element_located((By.ID, "chatScrollWindow")))
        container_rect = container.rect  # Bounding box of the container
        draggable_rect = draggable.rect  # Bounding box of the draggable element
        target_x = container_rect["x"] + container_rect["width"] - draggable_rect["width"]
        actions = ActionChains(self.driver)
        actions.click_and_hold(draggable).move_by_offset(target_x - draggable_rect["x"], 0).release().perform()
        new_style = draggable.get_attribute("style")
        match = re.search(r"translate\((-?\d+\.?\d*)px, (-?\d+\.?\d*)px\)", new_style)

        if match:
            new_x = float(match.group(1))  # Extract X value
            # print(f"Far X-Value Found: {new_x}")
            return new_x
        else:
            raise ValueError("Failed to extract final X position")
        
    def send_message(self, message):
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

    # ----------------- Test Select Enabled Features -----------------
    """This test ensures that the Select Enabled Features Movable Button is selectable and that
       the menu appears"""

    def test_select_enabled_features_menu(self):
        # A little more time to load
        time.sleep(3)
        
        # Find the Select Enabled Features Button
        select_enabled_features_button = self.wait.until(EC.presence_of_element_located((By.ID, "selectEnabledFeaturesClick")))
        self.assertTrue(select_enabled_features_button.is_displayed(), "Select Enabled Features Button element is visible")
        
        select_enabled_features_button.click()
        
        time.sleep(2)
        
        # Select Enabled Features Menu appears
        select_enabled_features_menu = self.wait.until(EC.presence_of_element_located((By.ID, "enabledFeaturesMenu")))
        self.assertTrue(select_enabled_features_menu.is_displayed(), "Select Enabled Features menu is visible")
    
    # ----------------- Test Select Enabled Features Click and Drag -----------------
    """This test ensures the Select Enabled Features button is draggable to all four corners 
       of its container."""

    def test_select_enabled_features_click_n_drag(self):

        time.sleep(3)
        
        # Find the Select Enabled Features Button
        select_enabled_features_button = self.wait.until(EC.presence_of_element_located((By.ID, "selectEnabledFeaturesClick")))
        self.assertTrue(select_enabled_features_button.is_displayed(), "Select Enabled Features Button element is visible")

        # Find draggable element
        draggable = self.wait.until(EC.presence_of_element_located((By.ID, "selectEnabledFeaturesDrag")))
        self.assertTrue(draggable.is_displayed(), "Draggable Menu should be visible")

        # Get dynamic top Y and far X values
        top_y = self.find_top_y_value()
        far_x = self.find_far_x_value()

        # Define four target positions
        target_positions = [
            (0, 17.125),     # Bottom-left
            (0, top_y),      # Move to top-left
            (far_x, top_y),  # Top-right
            (far_x, 17.125), # Bottom-right
        ]

        # Drag element to each target position
        for x, y in target_positions:
            self.drag_element(draggable, x, y)
            
    # ----------------- Test Select Enabled Features Click and Drag with Menu -----------------
    """This test ensures the Select Enabled Features button is draggable to all four corners 
    of its container when the menu is open."""

    def test_select_enabled_features_click_n_drag_with_menu(self):

        time.sleep(3)
        
        # Find the Select Enabled Features Button
        select_enabled_features_button = self.wait.until(EC.presence_of_element_located((By.ID, "selectEnabledFeaturesClick")))
        self.assertTrue(select_enabled_features_button.is_displayed(), "Select Enabled Features Button element is visible")
        
        select_enabled_features_button.click()

        # Find draggable element
        draggable = self.wait.until(EC.presence_of_element_located((By.ID, "selectEnabledFeaturesDrag")))
        self.assertTrue(draggable.is_displayed(), "Draggable element should be visible")

        # Get dynamic top Y and far X values
        top_y = self.find_top_y_value()
        far_x = self.find_far_x_value()

        # Define four target positions
        target_positions = [
            (0, 17.125),     # Bottom-left
            (0, top_y),      # Move to top-left
            (far_x, top_y),  # Top-right
            (far_x, 17.125), # Bottom-right
        ]

        # Drag element to each target position
        for x, y in target_positions:
            self.drag_element(draggable, x, y)
    

    
    # ----------------- Test Select Enabled Features Code Interpretor -----------------
    """This test ensures the Select Enabled Features Code Interpretor button is selectable."""
    
    def test_code_interpretor(self):
        # A little more time to load
        time.sleep(3)
        
        # Find the Select Enabled Features Button
        select_enabled_features_button = self.wait.until(EC.presence_of_element_located((By.ID, "selectEnabledFeaturesClick")))
        self.assertTrue(select_enabled_features_button.is_displayed(), "Select Enabled Features Button element is visible")
        
        select_enabled_features_button.click()
        
        time.sleep(2)
        
        # Select Enabled Features Menu appears
        select_enabled_features_menu = self.wait.until(EC.presence_of_element_located((By.ID, "enabledFeaturesMenu")))
        self.assertTrue(select_enabled_features_menu.is_displayed(), "Select Enabled Features menu is visible")
        
        select_enabled_features_list = self.wait.until(EC.presence_of_all_elements_located((By.ID, "enabledFeatureIndex")))
        select_enabled_features_list[0].click() # Clicks the Code Interpretor button
        
        self.send_message("Interpret this code: std::cout << 'Hello, world!' << std::endl;")
        time.sleep(20) # Extra 30 seconds since Code Interpretor is Long
    
    # ----------------- Test Select Enabled Features Clear All Enabled Features -----------------
    """This test ensures the Select Enabled Features Clear All Enabled Features button is selectable."""
    
    def test_clear_all_features(self):
        # A little more time to load
        time.sleep(3)
        
        # Find the Select Enabled Features Button
        select_enabled_features_button = self.wait.until(EC.presence_of_element_located((By.ID, "selectEnabledFeaturesClick")))
        self.assertTrue(select_enabled_features_button.is_displayed(), "Select Enabled Features Button element is visible")
        
        select_enabled_features_button.click()
        
        time.sleep(2)
        
        # Select Enabled Features Menu appears
        select_enabled_features_menu = self.wait.until(EC.presence_of_element_located((By.ID, "enabledFeaturesMenu")))
        self.assertTrue(select_enabled_features_menu.is_displayed(), "Select Enabled Features menu is visible")
        
        select_enabled_features_list = self.wait.until(EC.presence_of_all_elements_located((By.ID, "enabledFeatureIndex")))
        select_enabled_features_list[0].click() # Clicks the Code Interpretor button
        
        time.sleep(2)
        
        self.send_message("Interpret this code: std::cout << 'Hello, world!' << std::endl;")
        time.sleep(20) # Extra 30 seconds since Code Interpretor is Long
        
        select_enabled_features_list = self.wait.until(EC.presence_of_all_elements_located((By.ID, "enabledFeatureIndex")))
        select_enabled_features_list[3].click() # Clicks the Code Interpretor button
        
        time.sleep(2)
        
        self.send_message("Interpret this code: std::cout << 'Hello, world!' << std::endl;")
        time.sleep(10) # Extra 30 seconds since Code Interpretor is Long
        
    
if __name__ == "__main__":
    unittest.main(verbosity=2)
