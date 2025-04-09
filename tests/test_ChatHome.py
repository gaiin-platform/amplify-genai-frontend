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
from .base_test import BaseTest


class MassDeleteTests(BaseTest):

    def setUp(self):
        # Call the parent setUp with headless=True (or False for debugging)
        super().setUp(headless=True)

    # ----------------- Setup Test Data ------------------
    def create_folder(self, folder_name):
        time.sleep(5)
        folder_add_buttons = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "createFolderButton"))
        )
        self.assertGreater(
            len(folder_add_buttons),
            1,
            "Expected multiple buttons with ID 'createFolderButton'",
        )
        folder_add_buttons[0].click()

        try:
            alert = self.wait.until(EC.alert_is_present())
            self.assertIsNotNone(alert, "Alert prompt should be present")
            time.sleep(3)
            alert.send_keys(folder_name)
            time.sleep(3)
            alert.accept()
        except UnexpectedAlertPresentException as e:
            self.fail(f"Unexpected alert present: {str(e)}")

    def create_chat(self, chat_name):
        prompt_buttons = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "promptButton"))
        )
        self.assertTrue(prompt_buttons, "New Chat elements should be initialized")
        chat_add_button = next(
            (el for el in prompt_buttons if el.text == "New Chat"), None
        )
        self.assertIsNotNone(chat_add_button, "New Chat button should be present")
        chat_add_button.click()

        time.sleep(2)

        chat_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "chatName"))
        )
        self.assertTrue(chat_name_elements, "Drop name elements should be initialized")
        chats = next(
            (el for el in chat_name_elements if el.text == "New Conversation"), None
        )
        self.assertIsNotNone(chats, "New Conversation button should be present")
        chat_click = chats.find_element(By.XPATH, "./ancestor::button")
        button_id = chat_click.get_attribute("id")
        self.assertEqual(button_id, "chatClick", "Button should be called chatClick")
        chat_click.click()

        rename_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "isRenaming"))
        )
        self.assertIsNotNone(
            rename_button, "Rename button should be initialized and clicked"
        )
        rename_button.click()

        rename_field = self.wait.until(
            EC.presence_of_element_located((By.ID, "isRenamingInput"))
        )
        rename_field.clear()
        rename_field.send_keys(chat_name)
        rename_confirm_button = self.wait.until(
            EC.element_to_be_clickable((By.ID, "handleConfirm"))
        )
        self.assertIsNotNone(
            rename_confirm_button,
            "Rename confirm button should be initialized and clicked",
        )
        rename_confirm_button.click()
        drop_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "chatName"))
        )
        self.assertTrue(drop_name_elements, "Drop name elements should be initialized")

        time.sleep(2)

        folder = next((el for el in drop_name_elements if el.text == chat_name), None)
        self.assertIsNotNone(folder, "New Conversation button should be present")

    # ----------------- Setup Test Data ------------------
    def send_message(self, chat_name, message):
        # Locate all elements with the ID 'chatName'
        chat_name_elements = self.wait.until(
            EC.presence_of_all_elements_located((By.ID, "chatName"))
        )
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
        chat_input_bar = self.wait.until(
            EC.presence_of_element_located((By.ID, "messageChatInputText"))
        )
        self.assertTrue(chat_input_bar, "Chat bar input should be initialized")
        chat_input_bar.send_keys(message)

        time.sleep(2)

        # Locate the send message button
        chat_send_message = self.wait.until(
            EC.presence_of_element_located((By.ID, "sendMessage"))
        )
        self.assertTrue(chat_send_message, "Send message button should be initialized")
        chat_send_message.click()
        time.sleep(15)

    # id=""
    # id=""
    # id=""

    # ----------------- Send Chat -----------------
    def test_send_chat(self):

        # Create a chat
        self.create_chat("Wario")

        # Send a Message
        self.send_message("Wario", "WAAAAAAARIO TIIIIIIIME!!!")

    # ----------------- Test Change Model -----------------

    # ----------------- Test Store Conversation To Cloud -----------------

    # ----------------- Test Advanced Conversation Settings -----------------

    # ----------------- Test Change Custom Instructions -----------------

    # ----------------- Test Temperature Slider -----------------

    # ----------------- Test Select Enabled Features -----------------

    # ----------------- Test Select Enabled Features Click and Drag -----------------

    # ----------------- Test Select Enabled Features Clear All Enabled Features -----------------

    # ----------------- Test Select Enabled Features RAG -----------------

    # ----------------- Test Select Enabled Features Code Interpretor -----------------

    # ----------------- Test Collapse Left Sidebar -----------------

    # ----------------- Test Collapse Right Sidebar -----------------

    # ----------------- Test Files Inclusion -----------------

    # ----------------- Test Upload Files -----------------

    # ----------------- Test Select Assistants -----------------
