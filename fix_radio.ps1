$content = Get-Content "kit8\components\DesignSystemSelectorComponent.tsx" -Raw

# Add radio circle styles
$oldStyles = "  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {"

$newStyles = "  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  badge: {"

$content = $content.Replace($oldStyles, $newStyles)

# Add radio button circle in the card header
$oldHeader = "<View style={styles.cardHeader}>
                <Text style={{ fontSize: 20, marginRight: 8 }}>{item.icon}</Text>"

$newHeader = "<View style={styles.cardHeader}>
                {/* Radio button circle */}
                <View
                  style={[
                    styles.radioCircle,
                    {
                      borderColor: isActive ? themeColors.primary : themeColors.border,
                    },
                  ]}
                >
                  {isActive && (
                    <View
                      style={[
                        styles.radioCircleInner,
                        { backgroundColor: themeColors.primary },
                      ]}
                    />
                  )}
                </View>
                <Text style={{ fontSize: 20, marginRight: 8 }}>{item.icon}</Text>"

$content = $content.Replace($oldHeader, $newHeader)

Set-Content "kit8\components\DesignSystemSelectorComponent.tsx" -Value $content -NoNewline
Write-Output "done"
