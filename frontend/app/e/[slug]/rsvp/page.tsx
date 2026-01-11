'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';

interface TicketType {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  available: number;
  maxPerOrder: number;
}

interface PaymentGateway {
  id: string;
  name: string;
  gateway: string;
  currency: string;
  publicKey: string | null;
  sortOrder: number;
}

interface FormField {
  id: string;
  fieldName: string;
  label: string;
  type: string;
  placeholder: string | null;
  required: boolean;
  options: string[] | null;
}

interface FormData {
  eventId: string;
  eventName: string;
  rsvpMode: string;
  requireApproval: boolean;
  fields: FormField[];
  tickets: TicketType[];
  paymentGateways: PaymentGateway[];
}

export default function RSVPPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [formData, setFormData] = useState<FormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTickets, setSelectedTickets] = useState<Record<string, number>>({});
  const [customFields, setCustomFields] = useState<Record<string, any>>({});
  const [formValues, setFormValues] = useState({
    primaryName: '',
    secondaryName: '',
    email: '',
    phone: '',
    attendance: 'YES' as 'YES' | 'NO' | 'MAYBE',
    guestCount: 0,
    mealPreference: '',
    dietaryNotes: '',
    note: '',
    promoCode: '',
  });
  const [selectedGateway, setSelectedGateway] = useState<string>('');

  useEffect(() => {
    if (slug) {
      fetchFormData();
    }
  }, [slug]);

  const fetchFormData = async () => {
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const response = await fetch(`${API_BASE_URL}/api/ticketing/public/${slug}/form`);
      if (response.ok) {
        const data = await response.json();
        setFormData(data);
        if (data.paymentGateways?.length > 0) {
          setSelectedGateway(data.paymentGateways[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to fetch form data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTicketQuantityChange = (ticketId: string, quantity: number) => {
    if (quantity < 0) return;
    const ticket = formData?.tickets.find((t) => t.id === ticketId);
    if (ticket && quantity > ticket.maxPerOrder) {
      alert(`Maximum ${ticket.maxPerOrder} tickets allowed for ${ticket.name}`);
      return;
    }
    if (ticket && ticket.available !== 999 && quantity > ticket.available) {
      alert(`Only ${ticket.available} tickets available for ${ticket.name}`);
      return;
    }
    setSelectedTickets((prev) => ({
      ...prev,
      [ticketId]: quantity,
    }));
  };

  const calculateTotal = () => {
    if (!formData) return 0;
    let total = 0;
    Object.entries(selectedTickets).forEach(([ticketId, quantity]) => {
      if (quantity > 0) {
        const ticket = formData.tickets.find((t) => t.id === ticketId);
        if (ticket) {
          total += ticket.price * quantity;
        }
      }
    });
    return total;
  };

  const hasSelectedTickets = () => {
    return Object.values(selectedTickets).some((qty) => qty > 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData) return;

    if (formData.rsvpMode === 'paid' && !hasSelectedTickets()) {
      alert('Please select at least one ticket');
      return;
    }

    if (formData.rsvpMode === 'paid' && !selectedGateway) {
      alert('Please select a payment method');
      return;
    }

    setSubmitting(true);

    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

      if (formData.rsvpMode === 'paid') {
        // Handle paid ticket purchase
        const ticketArray = Object.entries(selectedTickets)
          .filter(([_, qty]) => qty > 0)
          .map(([ticketTypeId, quantity]) => ({
            ticketTypeId,
            quantity,
          }));

        const gateway = formData.paymentGateways.find((g) => g.id === selectedGateway);
        if (!gateway) {
          alert('Payment gateway not found');
          return;
        }

        // Process payment based on gateway
        let paymentReference = '';
        
        // TODO: Integrate actual payment SDKs (Stripe, Paystack, Flutterwave, etc.)
        // For now, we'll show a placeholder
        if (gateway.gateway === 'stripe' && gateway.publicKey) {
          // Stripe Checkout would go here
          alert('Stripe payment integration required');
          return;
        } else if (gateway.gateway === 'paystack' && gateway.publicKey) {
          // Paystack payment would go here
          alert('Paystack payment integration required');
          return;
        } else if (gateway.gateway === 'flutterwave' && gateway.publicKey) {
          // Flutterwave payment would go here
          alert('Flutterwave payment integration required');
          return;
        } else {
          // For testing - generate mock payment reference
          paymentReference = `TEST_${Date.now()}`;
        }

        const checkoutResponse = await fetch(
          `${API_BASE_URL}/api/ticketing/public/${slug}/checkout`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              primaryName: formValues.primaryName,
              secondaryName: formValues.secondaryName,
              email: formValues.email,
              phone: formValues.phone,
              tickets: ticketArray,
              promoCode: formValues.promoCode || undefined,
              paymentGatewayId: selectedGateway,
              paymentMethod: gateway.gateway,
              paymentReference: paymentReference,
              customFields: customFields,
              attendance: formValues.attendance,
              guestCount: formValues.guestCount,
              mealPreference: formValues.mealPreference || undefined,
              dietaryNotes: formValues.dietaryNotes || undefined,
              note: formValues.note || undefined,
              submissionChannel: 'web',
            }),
          }
        );

        if (checkoutResponse.ok) {
          const result = await checkoutResponse.json();
          window.location.href = `/e/${slug}/thanks?rsvp=${result.rsvp.id}`;
        } else {
          const error = await checkoutResponse.json();
          alert(error.message || 'Failed to process ticket purchase');
        }
      } else {
        // Handle free RSVP
        const rsvpResponse = await fetch(`${API_BASE_URL}/api/rsvp/${slug}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            primaryName: formValues.primaryName,
            secondaryName: formValues.secondaryName,
            email: formValues.email,
            phone: formValues.phone,
            attendance: formValues.attendance,
            guestCount: formValues.guestCount,
            mealPreference: formValues.mealPreference || undefined,
            dietaryNotes: formValues.dietaryNotes || undefined,
            note: formValues.note || undefined,
            submissionChannel: 'web',
          }),
        });

        if (rsvpResponse.ok) {
          const result = await rsvpResponse.json();
          window.location.href = `/e/${slug}/thanks?rsvp=${result.rsvp.id}`;
        } else {
          const error = await rsvpResponse.json();
          alert(error.message || 'Failed to submit RSVP');
        }
      }
    } catch (error) {
      console.error('Failed to submit:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!formData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Event Not Found</h1>
          <p>The event you're looking for doesn't exist or is no longer available.</p>
        </div>
      </div>
    );
  }

  const total = calculateTotal();
  const selectedTicketCount = Object.values(selectedTickets).reduce((sum, qty) => sum + qty, 0);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-purple-600">
            <h1 className="text-2xl font-bold text-white">{formData.eventName}</h1>
            <p className="text-blue-100 mt-1">
              {formData.rsvpMode === 'paid' ? 'Ticket Purchase' : 'RSVP'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Personal Information */}
            <div>
              <h2 className="text-lg font-semibold mb-4">Personal Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formValues.primaryName}
                    onChange={(e) => setFormValues({ ...formValues, primaryName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={formValues.phone}
                    onChange={(e) => setFormValues({ ...formValues, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formValues.email}
                    onChange={(e) => setFormValues({ ...formValues, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Guest Name (Optional)
                  </label>
                  <input
                    type="text"
                    value={formValues.secondaryName}
                    onChange={(e) => setFormValues({ ...formValues, secondaryName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Custom Form Fields */}
            {formData.fields.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Additional Information</h2>
                <div className="space-y-4">
                  {formData.fields.map((field) => (
                    <div key={field.id}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {field.label} {field.required && '*'}
                      </label>
                      {field.type === 'textarea' ? (
                        <textarea
                          required={field.required}
                          value={customFields[field.id] || ''}
                          onChange={(e) =>
                            setCustomFields({ ...customFields, [field.id]: e.target.value })
                          }
                          placeholder={field.placeholder || ''}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          rows={3}
                        />
                      ) : field.type === 'select' ? (
                        <select
                          required={field.required}
                          value={customFields[field.id] || ''}
                          onChange={(e) =>
                            setCustomFields({ ...customFields, [field.id]: e.target.value })
                          }
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Select...</option>
                          {field.options?.map((option, idx) => (
                            <option key={idx} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type === 'email' ? 'email' : field.type === 'phone' ? 'tel' : 'text'}
                          required={field.required}
                          value={customFields[field.id] || ''}
                          onChange={(e) =>
                            setCustomFields({ ...customFields, [field.id]: e.target.value })
                          }
                          placeholder={field.placeholder || ''}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ticket Selection (Paid Events) */}
            {formData.rsvpMode === 'paid' && formData.tickets.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-4">Select Tickets</h2>
                <div className="space-y-4">
                  {formData.tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-blue-500 transition"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg">{ticket.name}</h3>
                          {ticket.description && (
                            <p className="text-sm text-gray-600 mt-1">{ticket.description}</p>
                          )}
                          <p className="text-lg font-bold text-blue-600 mt-2">
                            {ticket.currency} {ticket.price.toFixed(2)}
                          </p>
                          <p className="text-xs text-gray-500 mt-1">
                            {ticket.available === 999
                              ? 'Unlimited'
                              : `${ticket.available} available`}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            type="button"
                            onClick={() =>
                              handleTicketQuantityChange(
                                ticket.id,
                                (selectedTickets[ticket.id] || 0) - 1
                              )
                            }
                            disabled={(selectedTickets[ticket.id] || 0) === 0}
                            className="w-8 h-8 rounded-full border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                          >
                            −
                          </button>
                          <span className="w-12 text-center font-semibold">
                            {selectedTickets[ticket.id] || 0}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleTicketQuantityChange(
                                ticket.id,
                                (selectedTickets[ticket.id] || 0) + 1
                              )
                            }
                            disabled={
                              (selectedTickets[ticket.id] || 0) >= ticket.maxPerOrder ||
                              (ticket.available !== 999 &&
                                (selectedTickets[ticket.id] || 0) >= ticket.available)
                            }
                            className="w-8 h-8 rounded-full border border-gray-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Promo Code */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Promo Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={formValues.promoCode}
                    onChange={(e) =>
                      setFormValues({ ...formValues, promoCode: e.target.value.toUpperCase() })
                    }
                    placeholder="Enter promo code"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Total */}
                {hasSelectedTickets() && (
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Total:</span>
                      <span className="text-2xl font-bold text-blue-600">
                        {formData.tickets[0]?.currency || 'USD'} {total.toFixed(2)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {selectedTicketCount} ticket{selectedTicketCount !== 1 ? 's' : ''} selected
                    </p>
                  </div>
                )}

                {/* Payment Gateway Selection */}
                {formData.paymentGateways.length > 0 && hasSelectedTickets() && (
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Payment Method *
                    </label>
                    <div className="space-y-2">
                      {formData.paymentGateways.map((gateway) => (
                        <label
                          key={gateway.id}
                          className={`flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                            selectedGateway === gateway.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200'
                          }`}
                        >
                          <input
                            type="radio"
                            name="paymentGateway"
                            value={gateway.id}
                            checked={selectedGateway === gateway.id}
                            onChange={(e) => setSelectedGateway(e.target.value)}
                            className="mr-3"
                          />
                          <div>
                            <div className="font-medium">{gateway.name}</div>
                            <div className="text-sm text-gray-500 capitalize">
                              {gateway.gateway.replace('_', ' ')}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* RSVP Details (Free Events) */}
            {formData.rsvpMode !== 'paid' && (
              <div>
                <h2 className="text-lg font-semibold mb-4">RSVP Details</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Will you be attending? *
                    </label>
                    <select
                      required
                      value={formValues.attendance}
                      onChange={(e) =>
                        setFormValues({
                          ...formValues,
                          attendance: e.target.value as 'YES' | 'NO' | 'MAYBE',
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="YES">Yes, I'll be there</option>
                      <option value="NO">No, I can't make it</option>
                      <option value="MAYBE">Maybe</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Number of Guests
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formValues.guestCount}
                      onChange={(e) =>
                        setFormValues({ ...formValues, guestCount: parseInt(e.target.value) || 0 })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Meal Preference
                    </label>
                    <input
                      type="text"
                      value={formValues.mealPreference}
                      onChange={(e) =>
                        setFormValues({ ...formValues, mealPreference: e.target.value })
                      }
                      placeholder="e.g., Vegetarian, Vegan, etc."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Dietary Notes
                    </label>
                    <textarea
                      value={formValues.dietaryNotes}
                      onChange={(e) =>
                        setFormValues({ ...formValues, dietaryNotes: e.target.value })
                      }
                      placeholder="Any allergies or dietary restrictions?"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Additional Notes
                    </label>
                    <textarea
                      value={formValues.note}
                      onChange={(e) => setFormValues({ ...formValues, note: e.target.value })}
                      placeholder="Anything else you'd like us to know?"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div className="pt-4 border-t">
              <button
                type="submit"
                disabled={submitting || (formData.rsvpMode === 'paid' && !hasSelectedTickets())}
                className="w-full bg-blue-600 text-white py-3 px-4 rounded-md font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {submitting
                  ? 'Processing...'
                  : formData.rsvpMode === 'paid'
                  ? `Purchase Tickets - ${formData.tickets[0]?.currency || 'USD'} ${total.toFixed(2)}`
                  : 'Submit RSVP'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
