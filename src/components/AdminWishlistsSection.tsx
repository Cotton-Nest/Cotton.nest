import React, { useState, useEffect } from 'react';
import {
  Heart,
  Search,
  MessageCircle,
  Phone,
  Mail,
  User,
  Package,
  Calendar,
  ExternalLink,
  Download,
  RefreshCw,
  Trash2,
  Sparkles,
  TrendingUp,
  Tag
} from 'lucide-react';
import { WishlistItem } from '../data/wishlist';
import { getWishlistsApi, removeWishlistItemApi } from '../services/api';

interface AdminWishlistsSectionProps {
  onShowToast: (msg: string) => void;
}

interface CustomerWishlistGroup {
  customerId: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  items: WishlistItem[];
  totalValue: number;
  lastActive: number;
}

export const AdminWishlistsSection: React.FC<AdminWishlistsSectionProps> = ({ onShowToast }) => {
  const [wishlists, setWishlists] = useState<WishlistItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);

  const fetchWishlists = async () => {
    setIsLoading(true);
    try {
      const items = await getWishlistsApi();
      setWishlists(items);
    } catch (err: any) {
      console.warn('Failed to load wishlists:', err);
      onShowToast('Could not fetch wishlists: ' + (err.message || 'Error'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWishlists();
  }, []);

  const handleDeleteItem = async (id: string, productName: string) => {
    if (!window.confirm(`Remove "${productName}" from customer wishlist?`)) return;
    try {
      await removeWishlistItemApi(id);
      setWishlists((prev) => prev.filter((item) => item.id !== id));
      onShowToast(`Removed "${productName}" from wishlist.`);
    } catch (err: any) {
      onShowToast('Failed to delete item: ' + (err.message || 'Error'));
    }
  };

  // Group by customer
  const customerGroupsMap: Record<string, CustomerWishlistGroup> = {};

  wishlists.forEach((item) => {
    const key = item.customerId || (item.customerPhone ? `phone_${item.customerPhone}` : `name_${item.customerName}`);
    if (!customerGroupsMap[key]) {
      customerGroupsMap[key] = {
        customerId: item.customerId,
        customerName: item.customerName || 'Atelier Guest',
        customerPhone: item.customerPhone,
        customerEmail: item.customerEmail,
        items: [],
        totalValue: 0,
        lastActive: item.createdAt || Date.now(),
      };
    }

    // Update phone/email if item has richer data
    if (item.customerPhone && !customerGroupsMap[key].customerPhone) {
      customerGroupsMap[key].customerPhone = item.customerPhone;
    }
    if (item.customerEmail && !customerGroupsMap[key].customerEmail) {
      customerGroupsMap[key].customerEmail = item.customerEmail;
    }

    customerGroupsMap[key].items.push(item);
    customerGroupsMap[key].totalValue += item.productPrice || 0;
    if (item.createdAt && item.createdAt > customerGroupsMap[key].lastActive) {
      customerGroupsMap[key].lastActive = item.createdAt;
    }
  });

  const customerGroups = Object.values(customerGroupsMap).sort((a, b) => b.lastActive - a.lastActive);

  // Filtered customer groups
  const filteredGroups = customerGroups.filter((group) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const nameMatch = group.customerName.toLowerCase().includes(q);
    const phoneMatch = group.customerPhone ? group.customerPhone.includes(q) : false;
    const emailMatch = group.customerEmail ? group.customerEmail.toLowerCase().includes(q) : false;
    const itemMatch = group.items.some((it) => it.productName.toLowerCase().includes(q));
    return nameMatch || phoneMatch || emailMatch || itemMatch;
  });

  const totalWishlistedItems = wishlists.length;
  const totalUniqueCustomers = customerGroups.length;
  const totalWishlistPipelineValue = wishlists.reduce((acc, it) => acc + (it.productPrice || 0), 0);

  const handleExportCSV = () => {
    if (wishlists.length === 0) {
      onShowToast('No wishlists to export.');
      return;
    }

    const headers = ['Customer Name', 'Phone', 'Email', 'Customer ID', 'Product Name', 'Price', 'Collection', 'Dimensions', 'Date Added'];
    const rows = wishlists.map((w) => [
      `"${w.customerName.replace(/"/g, '""')}"`,
      `"${(w.customerPhone || '').replace(/"/g, '""')}"`,
      `"${(w.customerEmail || '').replace(/"/g, '""')}"`,
      `"${w.customerId}"`,
      `"${w.productName.replace(/"/g, '""')}"`,
      w.productPrice,
      `"${(w.collection || '').replace(/"/g, '""')}"`,
      `"${(w.productDimensions || '').replace(/"/g, '""')}"`,
      `"${new Date(w.createdAt).toISOString()}"`,
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `cotton_nest_customer_wishlists_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast('Exported customer wishlists to CSV!');
  };

  const handleWhatsAppCustomer = (group: CustomerWishlistGroup, specificItem?: WishlistItem) => {
    if (!group.customerPhone) {
      onShowToast(`No phone number available for ${group.customerName}.`);
      return;
    }

    const cleanPhone = group.customerPhone.replace(/\D/g, '');
    const targetItem = specificItem || group.items[0];
    const message = encodeURIComponent(
      `Hello ${group.customerName}! Cotton Nest Atelier here in Sector 46 Gurgaon.\n\n` +
      `We noticed you wishlisted our "${targetItem.productName}" (₹${targetItem.productPrice.toLocaleString('en-IN')})!\n\n` +
      `We have stock ready for you with complimentary same-day delivery in Gurgaon. Would you like us to reserve a piece for you?`
    );

    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank');
  };

  return (
    <div className="space-y-6">
      {/* Top Banner & Pipeline Metrics */}
      <section className="bg-gradient-to-r from-[#FAF7F2] to-[#FAF3E8] border border-[#EAE2D5] rounded-3xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl border border-rose-100 shadow-2xs">
              <Heart className="w-6 h-6 fill-rose-500" />
            </div>
            <div>
              <h2 className="font-serif-luxury text-xl font-bold text-[#2C2420] flex items-center gap-2">
                <span>Customer Wishlists &amp; VIP Lead Center</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 font-sans font-bold">
                  {totalWishlistedItems} Items
                </span>
              </h2>
              <p className="text-xs text-[#7A6458] mt-1 max-w-2xl">
                Track what individual visitors save to their wishlists, see their contact numbers, and conduct personalized WhatsApp VIP outreach to convert interest into orders.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={fetchWishlists}
              className="px-3 py-2 bg-white hover:bg-[#FAF7F2] text-[#2C2420] border border-[#EAE2D5] rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-[#70252D] hover:bg-[#5C1E25] text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        {/* 3 Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-5">
          <div className="p-3.5 bg-white/90 rounded-2xl border border-[#EAE2D5]">
            <span className="text-[11px] font-semibold text-[#8C7A70] uppercase tracking-wider block">
              Unique Customers
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-serif-luxury text-2xl font-bold text-[#2C2420]">
                {totalUniqueCustomers}
              </span>
              <span className="text-xs text-[#7A6458]">interested buyers</span>
            </div>
          </div>

          <div className="p-3.5 bg-white/90 rounded-2xl border border-[#EAE2D5]">
            <span className="text-[11px] font-semibold text-[#8C7A70] uppercase tracking-wider block">
              Total Saved Bedsheets
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-serif-luxury text-2xl font-bold text-[#8C2E46]">
                {totalWishlistedItems}
              </span>
              <span className="text-xs text-[#7A6458]">items in wishlists</span>
            </div>
          </div>

          <div className="p-3.5 bg-white/90 rounded-2xl border border-[#EAE2D5]">
            <span className="text-[11px] font-semibold text-[#8C7A70] uppercase tracking-wider block">
              Wishlist Pipeline Value
            </span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="font-serif-luxury text-2xl font-bold text-emerald-700">
                ₹{totalWishlistPipelineValue.toLocaleString('en-IN')}
              </span>
              <span className="text-xs text-emerald-600 font-medium">pipeline potential</span>
            </div>
          </div>
        </div>
      </section>

      {/* Search and Filters */}
      <section className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-96">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A8988D]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by customer name, phone, or sheet name..."
            className="w-full pl-9 pr-4 py-2 bg-[#FAF7F2] border border-[#EAE2D5] rounded-xl text-xs text-[#2C2420] placeholder-[#A8988D] focus:outline-hidden focus:border-[#C29E57]"
          />
        </div>

        <span className="text-xs text-[#7A6458]">
          Showing {filteredGroups.length} of {customerGroups.length} customer wishlists
        </span>
      </section>

      {/* Customer Wishlist Groups Grid */}
      {isLoading ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-[#EAE2D5]">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#8C2E46] mb-3" />
          <p className="text-xs text-[#7A6458] font-medium">Loading customer wishlists...</p>
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-3xl border border-[#EAE2D5] p-6 space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full bg-rose-50 flex items-center justify-center text-rose-300">
            <Heart className="w-8 h-8" />
          </div>
          <h3 className="font-serif-luxury text-base font-bold text-[#2C2420]">
            No customer wishlists found
          </h3>
          <p className="text-xs text-[#7A6458] max-w-md mx-auto">
            {searchQuery
              ? 'No wishlists match your search query. Try clearing the search.'
              : 'When visitors click the heart icon on bedsheets in your store, their contact details and curated items will appear right here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map((group) => {
            const hasPhone = Boolean(group.customerPhone);
            const isGuest = !group.customerPhone && !group.customerEmail;

            return (
              <div
                key={group.customerId}
                className="bg-white rounded-2xl border border-[#EAE2D5] shadow-xs p-5 hover:border-[#DEC89B] transition-colors"
              >
                {/* Header: Customer Info & Outreach Actions */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#F4EFE6]">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#FAF7F2] border border-[#DEC89B] text-[#70252D] flex items-center justify-center font-bold text-sm shrink-0">
                      {group.customerName.charAt(0).toUpperCase()}
                    </div>

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-serif-luxury text-base font-bold text-[#2C2420]">
                          {group.customerName}
                        </h3>
                        {isGuest ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-stone-100 text-stone-600">
                            Guest Session
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            Identified VIP Lead
                          </span>
                        )}
                        <span className="text-xs text-[#8C7A70]">
                          · {group.items.length} {group.items.length === 1 ? 'sheet saved' : 'sheets saved'}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#7A6458] mt-1">
                        {group.customerPhone && (
                          <a
                            href={`tel:${group.customerPhone.replace(/\D/g, '')}`}
                            className="flex items-center gap-1 hover:text-[#70252D] font-medium"
                          >
                            <Phone className="w-3.5 h-3.5 text-[#3E7D5A]" />
                            <span>{group.customerPhone}</span>
                          </a>
                        )}

                        {group.customerEmail && (
                          <a
                            href={`mailto:${group.customerEmail}`}
                            className="flex items-center gap-1 hover:text-[#70252D]"
                          >
                            <Mail className="w-3.5 h-3.5 text-[#C29E57]" />
                            <span>{group.customerEmail}</span>
                          </a>
                        )}

                        <span className="flex items-center gap-1 text-[11px] text-[#A8988D]">
                          <Calendar className="w-3 h-3" />
                          Saved {new Date(group.lastActive).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Pipeline Value & Contact Buttons */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    <div className="text-right mr-2 hidden sm:block">
                      <span className="text-[10px] text-[#8C7A70] uppercase font-bold block">
                        Estimated Value
                      </span>
                      <span className="font-bold text-sm text-[#2C2420]">
                        ₹{group.totalValue.toLocaleString('en-IN')}
                      </span>
                    </div>

                    {hasPhone && (
                      <button
                        type="button"
                        onClick={() => handleWhatsAppCustomer(group)}
                        className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                        title="Direct WhatsApp outreach"
                      >
                        <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                        <span>WhatsApp VIP Offer</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Wishlisted Bedsheets Thumbnails & Metadata */}
                <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 bg-[#FAF7F2] rounded-xl border border-[#EAE2D5] flex gap-3 items-center justify-between group/item"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <img
                          src={item.productImage}
                          alt={item.productName}
                          className="w-12 h-12 rounded-lg object-cover border border-[#EAE2D5] bg-white shrink-0"
                        />
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-[#2C2420] truncate">
                            {item.productName}
                          </h4>
                          <p className="text-[10px] text-[#7A6458] truncate">
                            {item.threadCount || 'Pure Cotton'} {item.selectedVariantName ? `· ${item.selectedVariantName}` : ''}
                          </p>
                          <span className="text-xs font-bold text-[#8C2E46] block">
                            ₹{item.productPrice.toLocaleString('en-IN')}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-80 group-hover/item:opacity-100 transition-opacity">
                        {hasPhone && (
                          <button
                            type="button"
                            onClick={() => handleWhatsAppCustomer(group, item)}
                            className="p-1.5 bg-white text-emerald-700 hover:bg-emerald-50 border border-emerald-200 rounded-lg cursor-pointer"
                            title={`Send WhatsApp offer for "${item.productName}"`}
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteItem(item.id, item.productName)}
                          className="p-1.5 bg-white text-[#A8988D] hover:text-rose-600 border border-[#EAE2D5] hover:border-rose-200 rounded-lg cursor-pointer"
                          title="Remove item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
