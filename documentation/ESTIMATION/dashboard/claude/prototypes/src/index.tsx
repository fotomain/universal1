import React from 'react';
import { AppRegistry } from 'react-native';
import App from './Prototypes';

const id = new URLSearchParams(window.location.search).get('screen') ?? '1';
AppRegistry.registerComponent('Prototypes', () => () => <App id={id} />);
AppRegistry.runApplication('Prototypes', { rootTag: document.getElementById('root') });
