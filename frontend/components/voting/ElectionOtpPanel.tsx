type ElectionOtpPanelProps = {
  otpPhone: string;
  otpCode: string;
  otpVerified: boolean;
  submitting: boolean;
  onPhoneChange: (value: string) => void;
  onCodeChange: (value: string) => void;
  onRequestOtp: () => void;
  onVerifyOtp: () => void;
};

export default function ElectionOtpPanel({
  otpPhone,
  otpCode,
  otpVerified,
  submitting,
  onPhoneChange,
  onCodeChange,
  onRequestOtp,
  onVerifyOtp,
}: ElectionOtpPanelProps) {
  return (
    <section className="dashboard-canvas space-y-3 p-4">
      <h2 className="text-base font-semibold text-brand-900">Secure Election Check</h2>
      <p className="text-xs text-surface-600">Verify your phone once to cast your vote in election mode.</p>
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
      <p className="text-xs text-surface-600">
        {otpVerified ? 'Verification complete.' : 'Verification is required before voting.'}
      </p>
    </section>
  );
}
