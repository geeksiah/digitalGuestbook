export type EventPhase = 'PRE_EVENT' | 'LIVE' | 'POST_EVENT' | string;

export interface Owner {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  company?: string | null;
  countryCode?: string | null;
  isActive: boolean;
}

export interface RevenueByCurrency {
  gross: number;
  net: number;
}

export interface OwnerStats {
  totalEvents: number;
  totalRsvps: number;
  totalCheckIns: number;
  totalMedia: number;
  totalGiftOrders?: number;
  revenueByCurrency: Record<string, RevenueByCurrency>;
}

export interface EventCounters {
  rsvps: number;
  invitations: number;
  checkIns: number;
  mediaAssets: number;
  transactions: number;
  giftOrders?: number;
}

export interface TicketType {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  currency: string;
  quantitySold: number;
  quantityTotal: number;
  isActive: boolean;
}

export interface OwnerEvent {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  date: string;
  endDate?: string | null;
  venue: string | null;
  timezone?: string;
  defaultCurrency?: string;
  currentPhase: EventPhase;
  invitationOnly?: boolean;
  strictInviteOnly?: boolean;
  approvalStatus?: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED' | string;
  approvalSubmittedAt?: string | null;
  approvalReviewedAt?: string | null;
  approvalRejectionReason?: string | null;
  itineraryEnabled?: boolean;
  giftingEnabled?: boolean;
  _count: EventCounters;
  ticketTypes?: TicketType[];
}

export interface Invitation {
  id: string;
  accessCode: string;
  token: string;
  qrCodeData?: string | null;
  isCheckedIn: boolean;
}

export interface RSVP {
  id: string;
  primaryName: string;
  secondaryName?: string | null;
  email?: string | null;
  phone?: string | null;
  attendance: 'YES' | 'NO' | string;
  guestCount: number;
  mealPreference?: string | null;
  dietaryNotes?: string | null;
  note?: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | string;
  submittedAt: string;
  invitation?: Invitation | null;
}

export interface MediaAsset {
  id: string;
  type: 'VIDEO' | 'AUDIO' | 'PHOTO' | string;
  guestName?: string | null;
  filePath: string;
  fileName: string;
  fileSize?: number;
  duration?: number | null;
  thumbnailPath?: string | null;
  createdAt: string;
}

export interface CheckIn {
  id: string;
  invitation: {
    guestName: string;
    guestCount: number;
    accessCode: string;
  };
  checkedInAt: string;
  method: string;
}

export interface DomainRecord {
  id: string;
  host: string;
  isPrimary: boolean;
  status: 'PENDING_VERIFICATION' | 'VERIFIED' | 'ACTIVE' | 'FAILED' | string;
  verificationToken: string;
  verificationNotes?: string | null;
}

export interface RsvpInvite {
  id: string;
  inviteeName?: string | null;
  inviteePhone?: string | null;
  inviteeEmail?: string | null;
  channel?: 'whatsapp' | 'email' | 'both' | string;
  status: 'SENT' | 'OPENED' | 'RESPONDED' | 'EXPIRED' | string;
  initialResponse?: 'YES' | 'NO' | null;
  partySize?: number | null;
  note?: string | null;
  expiresAt?: string | null;
  sentAt?: string;
  createdAt?: string;
  openedAt?: string | null;
  respondedAt?: string | null;
}

export interface ItineraryItem {
  id: string;
  title: string;
  description?: string | null;
  startsAt?: string | null;
  endsAt?: string | null;
  location?: string | null;
  sortOrder: number;
  isCompleted: boolean;
  completedAt?: string | null;
}

export interface GiftOrder {
  id: string;
  guestName: string;
  guestPhone?: string | null;
  guestEmail?: string | null;
  currency: string;
  totalAmount: number;
  ownerNetAmount: number;
  platformFeeAmount: number;
  packageAmount: number;
  status: string;
  createdAt: string;
}

export interface Wallet {
  id: string;
  ownerId: string;
  bankName?: string | null;
  accountName?: string | null;
  accountNumber?: string | null;
  routingNumber?: string | null;
  swiftCode?: string | null;
  mobileProvider?: string | null;
  mobileNumber?: string | null;
  paypalEmail?: string | null;
  stripeAccountId?: string | null;
  paystackSubaccount?: string | null;
  paystackRecipientCode?: string | null;
  preferredMethod?: 'bank' | 'mobile' | 'paypal' | 'stripe' | 'paystack';
  currency?: string;
  autoPayoutEnabled?: boolean;
  autoPayoutThreshold?: number;
}

export type WalletMode = 'MANUAL_FALLBACK' | 'MANUAL_EXPLICIT' | 'AUTOMATED';

export interface OwnerPayoutWallet {
  id: string;
  walletType: 'manual' | 'offline' | 'stripe' | 'paypal' | 'paystack' | 'flutterwave';
  currency: string;
  countryCode?: string | null;
  isActive: boolean;
  isVerified: boolean;
  paystackSubaccount?: string | null;
  paystackRecipientCode?: string | null;
}

export interface ManualSettlementSummary {
  transactionCount: number;
  amountReceived: number;
  amountOwed: number;
  amountSettled: number;
  outstandingBalance: number;
}

export interface PaystackBank {
  code: string;
  name: string;
  currency?: string;
  country?: string;
}

export type PayoutStatus = 'PENDING' | 'PROCESSING' | 'FULFILLED' | 'DELAYED' | 'REJECTED' | string;

export interface PayoutRecord {
  id: string;
  eventId: string;
  requestedAmount: number;
  requestedCurrency?: string;
  currency?: string;
  payoutMethod?: string;
  status: PayoutStatus;
  createdAt: string;
  processedAt?: string | null;
  transactionRef?: string | null;
  notes?: string | null;
  event?: { id: string; name: string; slug: string };
}

export interface PayoutEventTotal {
  eventId: string;
  eventName: string;
  eventSlug: string;
  totalNet: number;
  currency: string;
  fulfilledAmount: number;
  pendingAmount: number;
  availableBalance: number;
  payoutCount: number;
}

export interface PayoutOverallTotals {
  totalNet: number;
  fulfilledAmount: number;
  pendingAmount: number;
  availableBalance: number;
  totalPayoutCount: number;
}

export interface PayoutResponse {
  payouts: PayoutRecord[];
  eventTotals: PayoutEventTotal[];
  overallTotals: PayoutOverallTotals;
}
