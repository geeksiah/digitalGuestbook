type ElectionOtpPanelProps = {
  requiresPhoneOtp: boolean;
  requiresManualId: boolean;
  manualIdLabel: string;
  otpPhone: string;
  otpCode: string;
  otpVerified: boolean;
  manualIdValue: string;
  manualIdVerified: boolean;
  manualIdName?: string | null;
  submitting: boolean;
  onPhoneChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onManualIdChange: (value: string) => void;
  onRequestOtp: () => void;
  onVerifyOtp: () => void;
  onVerifyManualId: () => void;
};

export default function ElectionOtpPanel({
  requiresPhoneOtp,
  requiresManualId,
  manualIdLabel,
  otpPhone,
  otpCode,
  otpVerified,
  manualIdValue,
  manualIdVerified,
  manualIdName,
  submitting,
  onPhoneChange,
  onCodeChange,
  onManualIdChange,
  onRequestOtp,
  onVerifyOtp,
  onVerifyManualId,
}: ElectionOtpPanelProps) {
  return (
    <section className="dashboard-canvas space-y-4 p-5">
      <div>
        <h2 className="text-lg font-semibold leading-tight text-brand-900">Verify your identity</h2>
        <p className="mt-1 text-sm leading-6 text-surface-600">Complete the required verification step before submitting your vote.</p>
      </div>

      {requiresPhoneOtp ? (
        <div className="space-y-3 rounded-3xl border border-surface-200 bg-white p-4">
          <div>
            <p className="text-sm font-semibold text-brand-900">Phone OTP</p>
            <p className="text-sm leading-6 text-surface-500">
              {otpVerified ? 'Phone verified.' : 'Verify your phone number once for this voting session.'}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr,1fr,auto,auto]">
            <input
              className="input"
              placeholder="Phone number"
              value={otpPhone}
              onChange={(event) => onPhoneChange(event.target.value)}
            />
            <input
              className="input"
              placeholder="Verification code"
              value={otpCode}
              onChange={(event) => onCodeChange(event.target.value)}
            />
            <button className="btn-outline" onClick={onRequestOtp} disabled={submitting}>
              Send code
            </button>
            <button className="btn-primary" onClick={onVerifyOtp} disabled={submitting}>
              Verify
            </button>
          </div>
        </div>
      ) : null}

      {requiresManualId ? (
        <div className="space-y-3 rounded-3xl border border-surface-200 bg-white p-4">
          <div>
            <p className="text-sm font-semibold text-brand-900">{manualIdLabel}</p>
            <p className="text-sm leading-6 text-surface-500">
              {manualIdVerified
                ? manualIdName
                  ? `Verified for ${manualIdName}.`
                  : 'Manual voter ID verified.'
                : 'Enter your approved voter ID to continue.'}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr,auto]">
            <input
              className="input"
              placeholder={manualIdLabel}
              value={manualIdValue}
              onChange={(event) => onManualIdChange(event.target.value)}
            />
            <button className="btn-primary" onClick={onVerifyManualId} disabled={submitting}>
              Verify ID
            </button>
          </div>
        </div>
      ) : null}

      <p className="text-sm leading-6 text-surface-600">
        {requiresPhoneOtp && requiresManualId
          ? otpVerified && manualIdVerified
            ? 'Phone and voter ID verification complete.'
            : 'Both phone verification and your approved voter ID are required before voting.'
          : requiresPhoneOtp
          ? otpVerified
            ? 'Phone verification complete.'
            : 'Phone verification is required before voting.'
          : requiresManualId
          ? manualIdVerified
            ? 'Voter ID verification complete.'
            : 'Your approved voter ID is required before voting.'
          : 'No verification is required for this vote.'}
      </p>
    </section>
  );
}
