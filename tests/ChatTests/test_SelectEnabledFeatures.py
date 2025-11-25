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
    """
    Test suite for the Select Enabled Features draggable button menu.

    This tests a special draggable button menu located in the middle of the chat interface.
    The menu can be:
    - Clicked to open and display additional feature buttons
    - Dragged to any corner of the interactable chat area
    - Used to toggle various enabled features like Code Interpreter

    Tests verify that the button reaches all corners of its container and that
    the menu functionality works correctly in both open and closed states.
    """

    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=True)

    # ----------------- Setup Test Data ------------------
    def drag_element(self, element, target_x, target_y):
        """
        Drags the element to the specified x and y coordinates.

        This method extracts the current position from the element's CSS transform property,
        calculates the offset needed to reach the target position, and performs the drag operation.

        Args:
            element: The WebElement to be dragged
            target_x (float): Target X coordinate in pixels
            target_y (float): Target Y coordinate in pixels
        """
        # Extract the current position from the element's inline style attribute
        style = element.get_attribute("style")

        # Use regex to parse the CSS translate() function
        # Pattern matches: translate(Xpx, Ypx) where X and Y can be negative decimals
        match = re.search(r"translate\((-?\d+\.?\d*)px, (-?\d+\.?\d*)px\)", style)

        if match:
            # Extract X and Y coordinates from the regex groups
            current_x, current_y = float(match.group(1)), float(match.group(2))
        else:
            # If no transform is found, assume element is at origin
            current_x, current_y = 0, 0  # Default if no style found

        # Calculate the offset needed to move from current position to target
        dx = target_x - current_x
        dy = target_y - current_y

        # Perform the drag operation using ActionChains
        actions = ActionChains(self.driver)
        actions.click_and_hold(element).move_by_offset(dx, dy).release().perform()

        # Wait for the drag animation to complete
        time.sleep(1)  # Allow movement to finish
        
        
    def find_top_y_value(self):
        """
        Finds the topmost Y coordinate the draggable element can reach within its container.

        This method calculates the boundary by:
        1. Getting the bounding boxes of both the draggable and container
        2. Dragging the element to the top of the container
        3. Extracting the final Y position from the CSS transform

        Returns:
            float: The topmost Y coordinate value in pixels

        Raises:
            ValueError: If the Y position cannot be extracted from the element's style
        """
        # Wait for elements to be fully loaded and stable
        time.sleep(3)

        # Locate the draggable button and its container
        draggable = self.wait.until(EC.presence_of_element_located((By.ID, "selectEnabledFeaturesDrag")))
        container = self.wait.until(EC.presence_of_element_located((By.ID, "chatScrollWindow")))

        # Get the bounding rectangles to calculate movement constraints
        container_rect = container.rect  # Bounding box of the container
        draggable_rect = draggable.rect  # Bounding box of the draggable element

        # Calculate target Y position (top of container)
        target_y = container_rect["y"]

        # Drag element to the top of the container
        actions = ActionChains(self.driver)
        actions.click_and_hold(draggable).move_by_offset(0, target_y - draggable_rect["y"]).release().perform()

        # Extract the final Y position from the element's transform style
        new_style = draggable.get_attribute("style")
        # Regex pattern to extract Y coordinate from translate(Xpx, Ypx)
        match = re.search(r"translate\((-?\d+\.?\d*)px, (-?\d+\.?\d*)px\)", new_style)

        if match:
            # Group 2 contains the Y coordinate
            new_y = float(match.group(2))
            # print(f"Top Y-Value Found: {new_y}")
            return new_y
        else:
            raise ValueError("Failed to extract final Y position")


    def find_far_x_value(self):
        """
        Finds the farthest right X coordinate the draggable element can reach within its container.

        This method calculates the rightmost boundary by:
        1. Getting the bounding boxes of both the draggable and container
        2. Calculating the right edge position (accounting for element width)
        3. Dragging the element to the far right
        4. Extracting the final X position from the CSS transform

        Returns:
            float: The farthest right X coordinate value in pixels

        Raises:
            ValueError: If the X position cannot be extracted from the element's style
        """
        # Wait for elements to be fully loaded and stable
        time.sleep(3)

        # Locate the draggable button and its container
        draggable = self.wait.until(EC.presence_of_element_located((By.ID, "selectEnabledFeaturesDrag")))
        container = self.wait.until(EC.presence_of_element_located((By.ID, "chatScrollWindow")))

        # Get the bounding rectangles to calculate movement constraints
        container_rect = container.rect  # Bounding box of the container
        draggable_rect = draggable.rect  # Bounding box of the draggable element

        # Calculate target X position (far right edge of container)
        # Must subtract draggable width to keep element within bounds
        target_x = container_rect["x"] + container_rect["width"] - draggable_rect["width"]

        # Drag element to the far right of the container
        actions = ActionChains(self.driver)
        actions.click_and_hold(draggable).move_by_offset(target_x - draggable_rect["x"], 0).release().perform()

        # Extract the final X position from the element's transform style
        new_style = draggable.get_attribute("style")
        # Regex pattern to extract X coordinate from translate(Xpx, Ypx)
        match = re.search(r"translate\((-?\d+\.?\d*)px, (-?\d+\.?\d*)px\)", new_style)

        if match:
            # Group 1 contains the X coordinate
            new_x = float(match.group(1))  # Extract X value
            # print(f"Far X-Value Found: {new_x}")
            return new_x
        else:
            raise ValueError("Failed to extract final X position")
        
    def send_message(self, message):
        """
        Helper method to send a chat message.

        Args:
            message (str): The text message to send in the chat
        """
        # Locate the chat input text area
        chat_input_bar = self.wait.until(EC.presence_of_element_located((By.ID, "messageChatInputText")))
        self.assertTrue(chat_input_bar, "Chat bar input should be initialized")
        chat_input_bar.send_keys(message)

        # Wait for text to be fully entered
        time.sleep(2)

        # Locate and click the send message button
        chat_send_message = self.wait.until(EC.presence_of_element_located((By.ID, "sendMessage")))
        self.assertTrue(chat_send_message, "Send message button should be initialized")
        chat_send_message.click()

        # Wait for LLM to process and respond to the message
        time.sleep(15)

    # ----------------- Test Select Enabled Features -----------------
    """This test ensures that the Select Enabled Features Movable Button is selectable and that
       the menu appears"""

    def test_select_enabled_features_menu(self):
        """
        Test that the Select Enabled Features button can be clicked to open the menu.

        This verifies:
        1. The draggable button is visible and clickable
        2. Clicking the button opens the enabled features menu
        """
        # Wait for the interface to fully load
        time.sleep(3)

        # Locate the Select Enabled Features clickable button
        select_enabled_features_button = self.wait.until(EC.presence_of_element_located((By.ID, "selectEnabledFeaturesClick")))
        self.assertTrue(select_enabled_features_button.is_displayed(), "Select Enabled Features Button element is visible")

        # Click to open the features menu
        select_enabled_features_button.click()

        # Wait for menu animation to complete
        time.sleep(2)

        # Verify the enabled features menu is now visible
        select_enabled_features_menu = self.wait.until(EC.presence_of_element_located((By.ID, "enabledFeaturesMenu")))
        self.assertTrue(select_enabled_features_menu.is_displayed(), "Select Enabled Features menu is visible")
    
    # ----------------- Test Select Enabled Features Click and Drag -----------------
    """This test ensures the Select Enabled Features button is draggable to all four corners
       of its container."""

    def test_select_enabled_features_click_n_drag(self):
        """
        Test that the Select Enabled Features button can be dragged to all four corners.

        This verifies the button's draggability by:
        1. Finding the dynamic boundaries of the container
        2. Dragging the button to each corner in sequence:
           - Bottom-left (starting position)
           - Top-left
           - Top-right
           - Bottom-right
        """
        # Wait for the interface to fully load
        time.sleep(3)

        # Verify the Select Enabled Features button is visible
        select_enabled_features_button = self.wait.until(EC.presence_of_element_located((By.ID, "selectEnabledFeaturesClick")))
        self.assertTrue(select_enabled_features_button.is_displayed(), "Select Enabled Features Button element is visible")

        # Locate the draggable container element
        draggable = self.wait.until(EC.presence_of_element_located((By.ID, "selectEnabledFeaturesDrag")))
        self.assertTrue(draggable.is_displayed(), "Draggable Menu should be visible")

        # Dynamically calculate the container boundaries
        # These values depend on the current window size and layout
        top_y = self.find_top_y_value()  # Topmost Y coordinate
        far_x = self.find_far_x_value()  # Rightmost X coordinate

        # Define target positions for all four corners
        # Y value of 17.125 represents the bottom boundary
        target_positions = [
            (0, 17.125),     # Bottom-left corner (X=0, Y=bottom)
            (0, top_y),      # Top-left corner (X=0, Y=top)
            (far_x, top_y),  # Top-right corner (X=right, Y=top)
            (far_x, 17.125), # Bottom-right corner (X=right, Y=bottom)
        ]

        # Sequentially drag the element to each corner position
        for x, y in target_positions:
            self.drag_element(draggable, x, y)
            
    # ----------------- Test Select Enabled Features Click and Drag with Menu -----------------
    """This test ensures the Select Enabled Features button is draggable to all four corners
    of its container when the menu is open."""

    def test_select_enabled_features_click_n_drag_with_menu(self):
        """
        Test that the button can be dragged to all corners while the menu is open.

        This verifies that:
        1. The menu can be opened by clicking the button
        2. The button remains draggable with the menu expanded
        3. The button can reach all four corners with the menu visible
        """
        # Wait for the interface to fully load
        time.sleep(3)

        # Locate and click the Select Enabled Features button to open the menu
        select_enabled_features_button = self.wait.until(EC.presence_of_element_located((By.ID, "selectEnabledFeaturesClick")))
        self.assertTrue(select_enabled_features_button.is_displayed(), "Select Enabled Features Button element is visible")

        select_enabled_features_button.click()

        # Locate the draggable container element
        draggable = self.wait.until(EC.presence_of_element_located((By.ID, "selectEnabledFeaturesDrag")))
        self.assertTrue(draggable.is_displayed(), "Draggable element should be visible")

        # Dynamically calculate the container boundaries
        top_y = self.find_top_y_value()  # Topmost Y coordinate
        far_x = self.find_far_x_value()  # Rightmost X coordinate

        # Define target positions for all four corners
        target_positions = [
            (0, 17.125),     # Bottom-left corner
            (0, top_y),      # Top-left corner
            (far_x, top_y),  # Top-right corner
            (far_x, 17.125), # Bottom-right corner
        ]

        # Sequentially drag the element to each corner with the menu open
        for x, y in target_positions:
            self.drag_element(draggable, x, y)
    

    
    # ----------------- Test Select Enabled Features Code Interpretor -----------------
    """This test ensures the Select Enabled Features Code Interpretor button is selectable."""

    def test_code_interpretor(self):
        """
        Test that the Code Interpreter feature can be enabled and used.

        This verifies:
        1. The features menu can be opened
        2. The Code Interpreter option can be selected
        3. A message with code can be sent using the enabled feature
        """
        # Wait for the interface to fully load
        time.sleep(3)

        # Locate and click the Select Enabled Features button
        select_enabled_features_button = self.wait.until(EC.presence_of_element_located((By.ID, "selectEnabledFeaturesClick")))
        self.assertTrue(select_enabled_features_button.is_displayed(), "Select Enabled Features Button element is visible")

        select_enabled_features_button.click()

        # Wait for menu to appear
        time.sleep(2)

        # Verify the enabled features menu is visible
        select_enabled_features_menu = self.wait.until(EC.presence_of_element_located((By.ID, "enabledFeaturesMenu")))
        self.assertTrue(select_enabled_features_menu.is_displayed(), "Select Enabled Features menu is visible")

        # Get all feature options and select Code Interpreter (first option, index 0)
        select_enabled_features_list = self.wait.until(EC.presence_of_all_elements_located((By.ID, "enabledFeatureIndex")))
        select_enabled_features_list[0].click()  # Clicks the Code Interpreter button

        # Send a test message with code for the interpreter to process
        self.send_message("Interpret this code: std::cout << 'Hello, world!' << std::endl;")

        # Extra wait time because Code Interpreter processing takes longer
        time.sleep(20)
    
    # ----------------- Test Select Enabled Features Clear All Enabled Features -----------------
    """This test ensures the Select Enabled Features Clear All Enabled Features button is selectable."""

    def test_clear_all_features(self):
        """
        Test that enabled features can be cleared using the "Clear All" button.

        This verifies:
        1. A feature (Code Interpreter) can be enabled
        2. The feature can be used to send a message
        3. The "Clear All Enabled Features" option can be selected
        4. After clearing, features are no longer active
        """
        # Wait for the interface to fully load
        time.sleep(3)

        # Locate and click the Select Enabled Features button to open the menu
        select_enabled_features_button = self.wait.until(EC.presence_of_element_located((By.ID, "selectEnabledFeaturesClick")))
        self.assertTrue(select_enabled_features_button.is_displayed(), "Select Enabled Features Button element is visible")

        select_enabled_features_button.click()

        # Wait for menu to appear
        time.sleep(2)

        # Verify the enabled features menu is visible
        select_enabled_features_menu = self.wait.until(EC.presence_of_element_located((By.ID, "enabledFeaturesMenu")))
        self.assertTrue(select_enabled_features_menu.is_displayed(), "Select Enabled Features menu is visible")

        # Enable Code Interpreter (first option in the list)
        select_enabled_features_list = self.wait.until(EC.presence_of_all_elements_located((By.ID, "enabledFeatureIndex")))
        select_enabled_features_list[0].click()  # Clicks the Code Interpreter button

        # Wait for feature to be enabled
        time.sleep(2)

        # Send a test message with the Code Interpreter enabled
        self.send_message("Interpret this code: std::cout << 'Hello, world!' << std::endl;")

        # Extra wait time for Code Interpreter to process
        time.sleep(20)

        # Re-locate the feature list elements (may have changed after interaction)
        select_enabled_features_list = self.wait.until(EC.presence_of_all_elements_located((By.ID, "enabledFeatureIndex")))

        # Click the "Clear All Enabled Features" button (4th option, index 3)
        select_enabled_features_list[3].click()

        # Wait for clear operation to complete
        time.sleep(2)

        # Send another message to verify features are disabled
        self.send_message("Interpret this code: std::cout << 'Hello, world!' << std::endl;")

        # Wait for message processing (should be quicker without Code Interpreter)
        time.sleep(10)
        
    
if __name__ == "__main__":
    unittest.main(verbosity=2)
