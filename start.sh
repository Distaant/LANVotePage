#!/bin/bash

# Set the window title (works in most terminal emulators)
echo -ne "\033]0;Classroom Grading App Launcher\007"

# Clear the screen
clear

echo "==========================================="
echo "      Classroom Grading App Launcher"
echo "==========================================="
echo ""

# 1. Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "[ERROR] Node.js is not installed!"
    echo "Please install it from https://nodejs.org/"
    echo ""
    read -p "Press enter to exit"
    exit 1
fi

# 2. Check and Install Dependencies
if [ ! -d "node_modules" ]; then
    echo "[INFO] First time setup detected. Installing required libraries..."
    echo "[INFO] Installing: express socket.io ip"
    
    npm install express socket.io ip

    if [ $? -ne 0 ]; then
        echo ""
        echo "[ERROR] Failed to install dependencies. Check your internet connection."
        read -p "Press enter to exit"
        exit 1
    fi
    
    echo "[SUCCESS] Libraries installed successfully."
    echo ""
else
    echo "[INFO] Dependencies found. Starting server..."
fi

# 3. Run the Server
echo ""
echo "[INFO] Starting Server..."
node server.js

# 4. Keep window open if it crashes or stops
echo ""
echo "[SERVER STOPPED]"
read -p "Press enter to exit"
