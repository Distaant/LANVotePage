#!/bin/bash

# [cite_start]Classroom Grading App Launcher [cite: 1]

clear
echo "==========================================="
echo "      Classroom Grading App Launcher"
echo "==========================================="
echo ""

# [cite_start]1. Check if Node.js is installed [cite: 2]
if ! command -v node &> /dev/null; then
    [cite_start]echo "[ERROR] Node.js is not installed!" [cite: 2]
    [cite_start]echo "Please install it from https://nodejs.org/" [cite: 2]
    echo ""
    read -p "Press enter to exit"
    exit 1
fi

# [cite_start]2. Check and Install Dependencies [cite: 2]
if [ ! -d "node_modules" ]; then
    [cite_start]echo "[INFO] First time setup detected. Installing required libraries..." [cite: 2]
    [cite_start]echo "[INFO] Installing: express socket.io ip" [cite: 2]
    npm install express socket.io ip
    
    if [ $? -ne 0 ]; then
        echo ""
        [cite_start]echo "[ERROR] Failed to install dependencies. Check your internet connection." [cite: 3]
        read -p "Press enter to exit"
        exit 1
    fi
    [cite_start]echo "[SUCCESS] Libraries installed successfully." [cite: 2]
    echo ""
else
    [cite_start]echo "[INFO] Dependencies found. Starting server..." [cite: 2]
fi

# [cite_start]3. Run the Server [cite: 4]
echo ""
[cite_start]echo "[INFO] Starting Server..." [cite: 4]
[cite_start]node server.js [cite: 4]

# [cite_start]4. Keep window open if it crashes [cite: 4]
echo ""
[cite_start]echo "[SERVER STOPPED]" [cite: 4]
read -p "Press enter to exit"