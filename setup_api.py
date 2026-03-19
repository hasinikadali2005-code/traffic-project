"""
Setup and run script for the Vehicle Detection API Server.
This script helps with installing dependencies and starting the server.
"""

import os
import sys
import subprocess
import platform


def print_header(text):
    """Print a formatted header."""
    print(f"\n{'=' * 60}")
    print(f"  {text}")
    print(f"{'=' * 60}\n")


def check_python():
    """Check if Python is available."""
    print_header("Checking Python Installation")
    print(f"Python Version: {sys.version}")
    print(f"Python Executable: {sys.executable}")
    return True


def install_dependencies():
    """Install required Python packages."""
    print_header("Installing Dependencies")
    
    requirements_file = os.path.join(os.path.dirname(__file__), 'requirements.txt')
    
    if not os.path.exists(requirements_file):
        print(f"❌ requirements.txt not found at {requirements_file}")
        return False
    
    print(f"Installing from {requirements_file}...")
    
    try:
        subprocess.check_call([
            sys.executable, '-m', 'pip', 'install', '-r', requirements_file
        ])
        print("✓ Dependencies installed successfully!")
        return True
    except subprocess.CalledProcessError as e:
        print(f"❌ Failed to install dependencies: {e}")
        return False


def start_server():
    """Start the Flask API server."""
    print_header("Starting Vehicle Detection API Server")
    
    script_path = os.path.join(os.path.dirname(__file__), 'api_server.py')
    
    if not os.path.exists(script_path):
        print(f"❌ api_server.py not found at {script_path}")
        return False
    
    print("Starting Flask server on http://localhost:5000")
    print("Press Ctrl+C to stop the server\n")
    
    try:
        subprocess.call([sys.executable, script_path])
        return True
    except KeyboardInterrupt:
        print("\n\nServer stopped.")
        return True
    except Exception as e:
        print(f"❌ Failed to start server: {e}")
        return False


def main():
    """Main setup and run function."""
    print_header("Vehicle Detection API Setup")
    
    # Check Python
    if not check_python():
        print("❌ Python check failed")
        sys.exit(1)
    
    # Install dependencies
    if not install_dependencies():
        print("❌ Dependency installation failed")
        sys.exit(1)
    
    print("\n✓ Setup complete!")
    print("\nYou can now run the server with:")
    print("  python api_server.py")
    print("\nOR use this script with --run flag:")
    print("  python setup.py --run")
    
    # Check for --run flag
    if '--run' in sys.argv or len(sys.argv) > 1 and sys.argv[1] == '--run':
        if not start_server():
            sys.exit(1)


if __name__ == '__main__':
    main()
