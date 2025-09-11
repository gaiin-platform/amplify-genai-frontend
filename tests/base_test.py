import unittest
import time
import os
from dotenv import load_dotenv
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.action_chains import ActionChains
from selenium.common.exceptions import UnexpectedAlertPresentException
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.chrome.service import Service


class BaseTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        """Setup that runs once per test class"""
        # Find project directory and load environment variables
        project_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        env_path = os.path.join(project_dir, ".env.local")
        load_dotenv(dotenv_path=env_path)

        # Store configuration for tests
        cls.base_url = os.getenv("NEXTAUTH_URL", "http://localhost:3000")
        cls.username = os.getenv("SELENIUM_USERNAME", "default_username")
        cls.password = os.getenv("SELENIUM_PASSWORD", "default_password")

    def setUp(self, headless=True):
        """Setup that runs before each test method"""
        # Configure Chrome options
        options = webdriver.ChromeOptions()
        
        # ⬇️ Use a persistent user profile
        profile_dir = os.path.join(os.path.dirname(__file__), "chrome_profile")
        options.add_argument(f"--user-data-dir={profile_dir}")
    
        if headless:
            options.add_argument("--headless")
            options.add_argument("--disable-gpu")
            options.add_argument("--window-size=1920,1080")

        # Initialize WebDriver with ChromeDriverManager
        service = Service(ChromeDriverManager().install())
        self.driver = webdriver.Chrome(service=service, options=options)
        self.driver.get(self.base_url)
        self.wait = WebDriverWait(self.driver, 10)

        # # Login before each test
        # self.login()
        
        if not self.is_logged_in():
            self.login()

    def tearDown(self):
        """Cleanup after each test method"""
        if hasattr(self, "driver") and self.driver:
            self.driver.quit()
            
    def is_logged_in(self):
        time.sleep(7)
        try:
            self.wait.until(
                EC.presence_of_element_located((By.ID, "messageChatInputText"))
            )
            return True
        except:
            return False

    def login(self):
        """Shared login method"""
        try:
            # Click the login button to reveal the login form
            login_button = self.wait.until(
                EC.element_to_be_clickable((By.ID, "loginButton"))
            )
            login_button.click()

            # Wait for the identifier and password fields to appear
            username_field = self.wait.until(
                lambda d: next(
                    (
                        e
                        for e in d.find_elements(By.NAME, "identifier")
                        if e.is_displayed()
                    ),
                    None,
                )
            )
            
            remember_me_label = self.wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "label[data-se-for-name='rememberMe']")))
            time.sleep(1)
            remember_me_label.click()
            

            # Enter username and password
            # username_field.send_keys(self.username)
            # password_field.send_keys(self.password)

            # Submit the login form
            form = self.driver.find_element(By.TAG_NAME, "form")
            form.submit()
            
            time.sleep(2)
            
            # password_field = self.wait.until(
            #     lambda d: next(
            #         (
            #             e
            #             for e in d.find_elements(By.NAME, "password")
            #             if e.is_displayed()
            #         ),
            #         None,
            #     )
            # )

            # Add a short delay to wait for the loading screen
            time.sleep(35)  # Wait for 8 seconds before proceeding

            # Wait for a post-login element to ensure login was successful
            self.wait.until(
                EC.visibility_of_element_located(
                    (By.ID, "messageChatInputText")  # Sidebar appears
                )
            )
        except Exception as e:
            self.fail(f"Login failed: {e}")
