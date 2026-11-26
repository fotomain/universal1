#!/bin/bash

# Change this if you are using an Ethernet adapter (e.g., "Ethernet")
SERVICE="AX88179A"

echo "=========================================="
echo " Resetting $SERVICE to Auto (DHCP)"
echo "=========================================="
echo "Administrator privileges required."

# Reset IPv4 configuration to DHCP (Auto)
sudo networksetup -setdhcp "$SERVICE"

# Clear custom DNS and revert to auto-assigned DNS
sudo networksetup -setdnsservers "$SERVICE" "Empty"

echo ""
echo "Settings successfully reset to Automatic (DHCP)!"
echo ""
echo "Current IPv4 Configuration:"
networksetup -getinfo "$SERVICE"

echo ""
echo "Current DNS Servers:"
networksetup -getdnsservers "$SERVICE"

echo ""
read -n 1 -s -r -p "Press any key to close this window..."
echo ""
