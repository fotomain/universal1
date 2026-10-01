/** @jest-environment jsdom */
import './pmUiTestKit';
import React from 'react';
import { act } from 'react';
import { cleanupUI, press, q, renderUI, textOf } from './pmUiTestKit';
import ErrorModalWindow, {
  showErrorModal,
  hideErrorModal,
  useErrorModalStore,
} from '../../../kit8/components/common/ErrorModalWindow';

afterEach(() => {
  act(() => {
    hideErrorModal();
  });
  cleanupUI();
});

describe('ErrorModalWindow', () => {
  it('renders nothing when not visible', () => {
    renderUI(<ErrorModalWindow />);
    expect(q('error-modal-window')).toBeNull();
  });

  it('shows error modal on PGRST205 PostgREST schema cache error', () => {
    renderUI(<ErrorModalWindow />);

    act(() => {
      showErrorModal({
        code: 'PGRST205',
        message: "Could not find the 'countryTable' in the schema cache",
        details: 'The table public.countryTable was not found.',
        hint: 'Verify the table exists and reload schema cache.',
      });
    });

    expect(q('error-modal-window')).not.toBeNull();
    expect(q('error-modal-code')).not.toBeNull();
    expect(textOf('error-modal-code')).toContain('PGRST205');
    expect(textOf('error-modal-message')).toContain("Could not find the 'countryTable' in the schema cache");
    expect(textOf('error-modal-details')).toContain('The table public.countryTable was not found.');
    expect(textOf('error-modal-hint')).toContain('Verify the table exists and reload schema cache.');
  });

  it('dismisses modal on close button press', () => {
    renderUI(<ErrorModalWindow />);

    act(() => {
      showErrorModal({
        code: '500',
        message: 'Something went wrong',
      });
    });

    expect(q('error-modal-window')).not.toBeNull();
    press('error-modal-close-btn');
    expect(q('error-modal-window')).toBeNull();
  });

  it('dismisses modal when hideErrorModal is called', () => {
    renderUI(<ErrorModalWindow />);

    act(() => {
      showErrorModal('Generic string error');
    });

    expect(q('error-modal-window')).not.toBeNull();

    act(() => {
      hideErrorModal();
    });

    expect(q('error-modal-window')).toBeNull();
  });
});
