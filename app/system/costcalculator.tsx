import React from 'react';
import CostCalculatorScreen from '../../kit8/system/costcalculator/CostCalculatorScreen';

// route /system/costcalculator - System settings > Cost calculator: the administrator types the size of his work (projects, tasks, plan lines, users, changes, ROI, reports)
// and gets the Supabase cloud bill, the virtual machine that is needed and the numbers behind them (documentation/PRICE_PLAN_CALCULATOR.html)
export default function CostCalculatorRoute() {
  return <CostCalculatorScreen />;
}
