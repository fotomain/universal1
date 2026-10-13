import React from 'react';
import { View } from 'react-native';
import Monitor01Dashboard from '../../../../kit8/pm/reports/monitor01/Monitor01Dashboard';

// route: /pm/reports/monitor01 - Monitor01 as a separate screen (hamburger menu → Reports → Monitor01): the FULL data set of the user, with the filters
// startDate · finishDate · Project · Task · Resource above the table
export default function Monitor01Route() {
  return (
    <View style={{ flex: 1 }}>
      <Monitor01Dashboard mode="standalone" />
    </View>
  );
}
