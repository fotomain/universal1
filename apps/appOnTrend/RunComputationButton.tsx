import React from 'react';
import { StyleSheet } from 'react-native';
import { useSelector } from 'react-redux';
import { ButtonPrimaryApp } from '../../kit8/components/common';
import { ButtonAppProps } from '../../kit8/components/common/ButtonApp';
import { OnTrendState } from '../../kit8/redux/onTrendSlice';

export interface RunComputationButtonProps extends Partial<Omit<ButtonAppProps, 'variant'>> {
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
}

export const RunComputationButton: React.FC<RunComputationButtonProps> = ({
  onPress = () => console.log('[RunComputationButton] Pressed'),
  loading = false,
  disabled: explicitDisabled,
  icon = 'play_arrow',
  style,
  children = 'Run Computation',
  ...rest
}) => {
  const onTrendState = useSelector((state: any) => state?.onTrendState as OnTrendState);

  const shopCount = onTrendState?.googleDriveNumberOfFiles?.dataset_shop_images ?? 0;
  const trendCount = onTrendState?.googleDriveNumberOfFiles?.dataset_trend_images ?? 0;
  const isUploading = onTrendState?.googleDriveUploading ?? false;

  // RunComputationButton must be enabled only if:
  // onTrendState.googleDriveNumberOfFiles.dataset_shop_images <> 0
  // onTrendState.googleDriveNumberOfFiles.dataset_trend_images <> 0
  // onTrendState.googleDriveUploading: false
  const isEligible = shopCount !== 0 && trendCount !== 0 && !isUploading;
  const isDisabled = explicitDisabled !== undefined ? (explicitDisabled || !isEligible) : !isEligible;

  return (
    <ButtonPrimaryApp
      icon={icon}
      loading={loading}
      disabled={isDisabled}
      onPress={onPress}
      style={[styles.button, style]}
      {...rest}
    >
      {children}
    </ButtonPrimaryApp>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 10,
    elevation: 2,
  },
});

export default RunComputationButton;
