import SelectorFromApp, { SelectorFromAppProps, SelectorOption as AppSelectorOption } from '../components/common/SelectorFromApp';

export type SelectorOption<T = string> = AppSelectorOption<T>;
export type SelectorFromComponentProps<T extends string = string> = SelectorFromAppProps<T>;
export const SelectorFromComponent = SelectorFromApp;
export default SelectorFromApp;
