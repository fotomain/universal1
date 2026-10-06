import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
// NOTE: Do NOT import 'leaflet/dist/leaflet.css' here — Metro bundler cannot process
// local url() references inside node_modules CSS (e.g. url(images/layers.png)).
// Instead we inject the CSS via a <link> tag pointing to the CDN version.

export default function MapMi() {
  useEffect(() => {
    if (typeof document === 'undefined') return;

    // Inject Leaflet CSS from CDN — avoids Metro's unsupported local url() in CSS
    const linkId = 'leaflet-css-cdn';
    if (!document.getElementById(linkId)) {
      const link = document.createElement('link');
      link.id = linkId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.integrity = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
      link.crossOrigin = '';
      document.head.appendChild(link);
    }

    // Fix Leaflet default marker icon paths broken by bundlers
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const L = require('leaflet');
    delete (L.Icon.Default.prototype as any)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  }, []);

  return (
    <View style={styles.container}>
      <MapContainer center={[51.505, -0.09]} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <Marker position={[51.505, -0.09]}>
          <Popup>A sample location</Popup>
        </Marker>
      </MapContainer>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', height: 400 },
});
