#!/bin/bash

# Network configuration values
IP="86.63.164.50"
SUBNET="255.255.254.0"
ROUTER="86.63.164.1"
DNS1="31.170.23.2"
DNS2="8.8.8.8"

# Change this if you are using an Ethernet adapter (e.g., "Ethernet", "Thunderbolt Ethernet", or "USB 10/100/1000 LAN")
SERVICE="Ethernet"

echo "=========================================="
echo " Applying Network Settings to: $SERVICE"
echo "=========================================="
echo "IP Address : $IP"
echo "Subnet Mask: $SUBNET"
echo "Gateway    : $ROUTER"
echo "DNS        : $DNS1, $DNS2"
echo "------------------------------------------"
echo "Administrator privileges required."

# Apply Manual IPv4 settings
sudo networksetup -setmanual "$SERVICE" "$IP" "$SUBNET" "$ROUTER"

# Apply DNS servers
sudo networksetup -setdnsservers "$SERVICE" "$DNS1" "$DNS2"

echo ""
echo "Settings successfully applied!"
echo ""
echo "Current IPv4 Configuration:"
networksetup -getinfo "$SERVICE"

echo ""
echo "Current DNS Servers:"
networksetup -getdnsservers "$SERVICE"

echo ""
read -n 1 -s -r -p "Press any key to close this window..."
echo ""
