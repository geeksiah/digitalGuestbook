import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IonBackButton,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToolbar,
  useIonToast
} from '@ionic/react';
import { useParams } from 'react-router-dom';
import { itineraryApi, ownerDashboardApi } from '../api/client';
import type {
  CheckIn,
  DomainRecord,
  GiftOrder,
  ItineraryItem,
  MediaAsset,
  OwnerEvent,
  RSVP,
  RsvpInvite,
  TicketType
} from '../types/domain';
import { copyText, formatCurrency, formatDate, formatDateTime, phaseLabel, statusToneClass } from '../utils/format';
import { getErrorMessage } from '../utils/error';

type EventTab = 'overview' | 'rsvps' | 'checkin' | 'media' | 'tickets' | 'itinerary' | 'invites' | 'domains' | 'gifts';

const cnameTarget = import.meta.env.VITE_DOMAIN_CNAME_TARGET || 'cname.eventpeepo.com';

const EventDetailsPage = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [present] = useIonToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<EventTab>('overview');
  const [event, setEvent] = useState<OwnerEvent | null>(null);

  const [rsvpFilter, setRsvpFilter] = useState('all');
  const [rsvps, setRsvps] = useState<RSVP[]>([]);
  const [reviewingRsvpId, setReviewingRsvpId] = useState<string | null>(null);
  const [checkins, setCheckins] = useState<CheckIn[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [mediaFilter, setMediaFilter] = useState<'ALL' | 'PHOTO' | 'VIDEO' | 'AUDIO'>('ALL');
  const [mediaSelectMode, setMediaSelectMode] = useState(false);
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [deletingMedia, setDeletingMedia] = useState(false);
  const [downloadingMedia, setDownloadingMedia] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<MediaAsset | null>(null);
  const [tickets, setTickets] = useState<TicketType[]>([]);
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [domainHost, setDomainHost] = useState('');
  const [savingDomain, setSavingDomain] = useState(false);
  const [invites, setInvites] = useState<RsvpInvite[]>([]);
  const [inviteLines, setInviteLines] = useState('');
  const [inviteExpiryHours, setInviteExpiryHours] = useState(240);
  const [inviteChannel, setInviteChannel] = useState<'whatsapp' | 'email' | 'both'>('whatsapp');
  const [importingInvites, setImportingInvites] = useState(false);
  const inviteFileInputRef = useRef<HTMLInputElement | null>(null);
  const [sendingInvites, setSendingInvites] = useState(false);
  const [validatingInvites, setValidatingInvites] = useState(false);
  const [inviteValidation, setInviteValidation] = useState<{
    total: number;
    valid: number;
    invalid: number;
    duplicates: number;
  } | null>(null);
  const [giftOrders, setGiftOrders] = useState<GiftOrder[]>([]);
  const [itineraryItems, setItineraryItems] = useState<ItineraryItem[]>([]);
  const [showItineraryOptionalFields, setShowItineraryOptionalFields] = useState(false);
  const [savingItinerary, setSavingItinerary] = useState(false);
  const [creatingMcLink, setCreatingMcLink] = useState(false);
  const [mcControlUrl, setMcControlUrl] = useState('');
  const [newItinerary, setNewItinerary] = useState({
    title: '',
    description: '',
    startsAt: '',
    endsAt: '',
    location: ''
  });

  const toastError = (error: unknown, fallback: string) => {
    present({ message: getErrorMessage(error, fallback), duration: 2200, color: 'danger' });
  };

  const loadEvent = useCallback(async () => {
    if (!eventId) return;
    try {
      setLoading(true);
      const response = await ownerDashboardApi.event(eventId);
      setEvent(response.data.event);
    } catch (error: unknown) {
      toastError(error, 'Failed to load event');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  const loadRsvps = useCallback(async () => {
    if (!eventId) return;
    try {
      const response = await ownerDashboardApi.rsvps(eventId, rsvpFilter);
      setRsvps(response.data.rsvps || []);
    } catch (error: unknown) {
      toastError(error, 'Failed to load RSVPs');
    }
  }, [eventId, rsvpFilter]);

  const loadCheckins = useCallback(async () => {
    if (!eventId) return;
    try {
      const response = await ownerDashboardApi.checkins(eventId);
      setCheckins(response.data.checkIns || []);
    } catch (error: unknown) {
      toastError(error, 'Failed to load check-ins');
    }
  }, [eventId]);

  const loadMedia = useCallback(async () => {
    if (!eventId) return;
    try {
      const response = await ownerDashboardApi.media(eventId);
      setMedia(response.data.media || []);
    } catch (error: unknown) {
      toastError(error, 'Failed to load media');
    }
  }, [eventId]);

  const loadTickets = useCallback(async () => {
    if (!eventId) return;
    try {
      const response = await ownerDashboardApi.tickets(eventId);
      setTickets(response.data.tickets || []);
    } catch (error: unknown) {
      toastError(error, 'Failed to load tickets');
    }
  }, [eventId]);

  const loadDomains = useCallback(async () => {
    if (!eventId) return;
    try {
      const response = await ownerDashboardApi.domains(eventId);
      setDomains(response.data.domains || []);
    } catch (error: unknown) {
      toastError(error, 'Failed to load domains');
    }
  }, [eventId]);

  const loadInvites = useCallback(async () => {
    if (!eventId) return;
    try {
      const response = await ownerDashboardApi.invites(eventId);
      setInvites(response.data.invites || []);
    } catch (error: unknown) {
      toastError(error, 'Failed to load invites');
    }
  }, [eventId]);

  const loadGifts = useCallback(async () => {
    if (!eventId) return;
    try {
      const response = await ownerDashboardApi.gifts(eventId);
      setGiftOrders(response.data.orders || []);
    } catch (error: unknown) {
      toastError(error, 'Failed to load gift orders');
    }
  }, [eventId]);

  const loadItinerary = useCallback(async () => {
    if (!eventId) return;
    try {
      const response = await itineraryApi.getItems(eventId);
      setItineraryItems(response.data.items || []);
    } catch (error: unknown) {
      toastError(error, 'Failed to load itinerary');
    }
  }, [eventId]);

  const loadForTab = useCallback(async (tab: EventTab) => {
    if (tab === 'rsvps') await loadRsvps();
    if (tab === 'checkin') await loadCheckins();
    if (tab === 'media') await loadMedia();
    if (tab === 'tickets') await loadTickets();
    if (tab === 'domains') await loadDomains();
    if (tab === 'invites') await loadInvites();
    if (tab === 'gifts') await loadGifts();
    if (tab === 'itinerary') await loadItinerary();
  }, [loadCheckins, loadDomains, loadGifts, loadInvites, loadItinerary, loadMedia, loadRsvps, loadTickets]);

  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);

  useEffect(() => {
    if (!event) return;
    void loadForTab(activeTab);
  }, [activeTab, event, loadForTab]);

  useEffect(() => {
    if (activeTab !== 'rsvps' || !event) return;
    void loadRsvps();
  }, [activeTab, event, loadRsvps]);

  const onRefresh = async () => {
    await loadEvent();
    await loadForTab(activeTab);
  };

  const tabCounts = useMemo(() => ({
    rsvps: event?._count.rsvps || 0,
    checkin: event?._count.checkIns || 0,
    media: event?._count.mediaAssets || 0,
    tickets: tickets.length,
    itinerary: itineraryItems.length,
    invites: invites.length,
    domains: domains.length,
    gifts: giftOrders.length
  }), [domains.length, event?._count.checkIns, event?._count.mediaAssets, event?._count.rsvps, giftOrders.length, invites.length, itineraryItems.length, tickets.length]);

  const filteredMedia = useMemo(() => {
    if (mediaFilter === 'ALL') return media;
    return media.filter((asset) => String(asset.type).toUpperCase() === mediaFilter);
  }, [media, mediaFilter]);

  const mediaAlbums = useMemo(() => {
    const photos = media.filter((asset) => String(asset.type).toUpperCase() === 'PHOTO');
    const videos = media.filter((asset) => String(asset.type).toUpperCase() === 'VIDEO');
    const audios = media.filter((asset) => String(asset.type).toUpperCase() === 'AUDIO');
    return { photos, videos, audios };
  }, [media]);

  const copyEventLink = async () => {
    if (!event) return;
    const ok = await copyText(`${window.location.origin}/e/${event.slug}`);
    present({ message: ok ? 'Event link copied' : 'Unable to copy link', duration: 1800, color: ok ? 'success' : 'danger' });
  };

  const copyMcLink = async () => {
    if (!mcControlUrl) return;
    const ok = await copyText(mcControlUrl);
    present({ message: ok ? 'MC link copied' : 'Unable to copy MC link', duration: 1800, color: ok ? 'success' : 'danger' });
  };

  const copyShareLink = async (path: string, label: string) => {
    const ok = await copyText(`${window.location.origin}${path}`);
    present({ message: ok ? `${label} link copied` : 'Unable to copy link', duration: 1800, color: ok ? 'success' : 'danger' });
  };

  const reviewRsvp = async (rsvpId: string, status: 'PENDING' | 'APPROVED' | 'REJECTED') => {
    if (!eventId) return;
    setReviewingRsvpId(rsvpId);
    try {
      await ownerDashboardApi.updateRsvpStatus(eventId, rsvpId, status);
      present({
        message: status === 'APPROVED' ? 'RSVP approved' : status === 'REJECTED' ? 'RSVP rejected' : 'RSVP set to pending',
        duration: 1800,
        color: 'success'
      });
      await Promise.all([loadRsvps(), loadEvent()]);
    } catch (error: unknown) {
      toastError(error, 'Failed to review RSVP');
    } finally {
      setReviewingRsvpId(null);
    }
  };

  const parseInviteLines = (raw: string): Array<{ name?: string; phone?: string; email?: string }> => {
    return raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(',').map((part) => part.trim());
        if (parts.length === 1) {
          if (parts[0].includes('@')) return { email: parts[0] };
          return { phone: parts[0] };
        }
        if (parts.length === 2) {
          if (parts[1].includes('@')) return { name: parts[0], email: parts[1] };
          return { name: parts[0], phone: parts[1] };
        }
        return { name: parts[0], phone: parts[1], email: parts[2] };
      })
      .filter((invite) => Boolean(invite.phone || invite.email));
  };

  const parseCsvRow = (row: string) => {
    const cols: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"') {
        if (inQuotes && row[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        cols.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    cols.push(current.trim());
    return cols;
  };

  const buildInviteLine = (name: string, phone: string, email: string) => {
    if (inviteChannel === 'whatsapp') {
      if (name && phone && email) return `${name},${phone},${email}`;
      if (name && phone) return `${name},${phone}`;
      if (phone) return phone;
      return '';
    }
    if (inviteChannel === 'email') {
      if (name && email) return `${name},${email}`;
      if (email) return email;
      return '';
    }
    if (name && phone && email) return `${name},${phone},${email}`;
    return '';
  };

  const importInviteRows = (rows: string[][]) => {
    if (!rows.length) return 0;

    const header = rows[0].map((value) => value.toLowerCase());
    const hasHeader = header.some((value) => ['name', 'full name', 'phone', 'mobile', 'tel', 'email', 'e-mail'].includes(value));
    const indexOfHeader = (labels: string[]) => header.findIndex((value) => labels.includes(value));
    const nameIdx = hasHeader ? indexOfHeader(['name', 'full name']) : 0;
    const phoneIdx = hasHeader ? indexOfHeader(['phone', 'mobile', 'tel']) : 1;
    const emailIdx = hasHeader ? indexOfHeader(['email', 'e-mail']) : 2;
    const dataRows = hasHeader ? rows.slice(1) : rows;

    const lines = dataRows
      .map((cols) => {
        const name = (nameIdx >= 0 ? cols[nameIdx] : cols[0] || '').trim();
        const phone = (phoneIdx >= 0 ? cols[phoneIdx] : cols[1] || '').trim();
        const email = (emailIdx >= 0 ? cols[emailIdx] : cols[2] || '').trim();
        return buildInviteLine(name, phone, email);
      })
      .filter(Boolean);

    if (!lines.length) return 0;
    setInviteLines((prev) => {
      const existing = prev
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean);
      return Array.from(new Set([...existing, ...lines])).join('\n');
    });
    return lines.length;
  };

  const importInviteText = (text: string) => {
    const rows = text
      .split(/\r?\n/)
      .map((row) => row.trim())
      .filter(Boolean)
      .map(parseCsvRow);
    return importInviteRows(rows);
  };

  const parseXlsxRows = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const view = new DataView(arrayBuffer);
    const decoder = new TextDecoder();

    const eocdSignature = 0x06054b50;
    const centralSignature = 0x02014b50;
    const localSignature = 0x04034b50;

    let eocdOffset = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (view.getUint32(i, true) === eocdSignature) {
        eocdOffset = i;
        break;
      }
    }
    if (eocdOffset < 0) throw new Error('Invalid XLSX file');

    const centralSize = view.getUint32(eocdOffset + 12, true);
    const centralOffset = view.getUint32(eocdOffset + 16, true);

    const unzipEntryText = async (entryName: string) => {
      let offset = centralOffset;
      const centralEnd = centralOffset + centralSize;
      while (offset < centralEnd) {
        if (view.getUint32(offset, true) !== centralSignature) break;
        const compression = view.getUint16(offset + 10, true);
        const compressedSize = view.getUint32(offset + 20, true);
        const fileNameLength = view.getUint16(offset + 28, true);
        const extraLength = view.getUint16(offset + 30, true);
        const commentLength = view.getUint16(offset + 32, true);
        const localOffset = view.getUint32(offset + 42, true);
        const fileName = decoder.decode(bytes.slice(offset + 46, offset + 46 + fileNameLength));

        if (fileName === entryName) {
          if (view.getUint32(localOffset, true) !== localSignature) throw new Error('Invalid XLSX entry');
          const localNameLen = view.getUint16(localOffset + 26, true);
          const localExtraLen = view.getUint16(localOffset + 28, true);
          const dataStart = localOffset + 30 + localNameLen + localExtraLen;
          const compressed = bytes.slice(dataStart, dataStart + compressedSize);

          let uncompressed: Uint8Array;
          if (compression === 0) {
            uncompressed = compressed;
          } else if (compression === 8) {
            const inflateCtor = (globalThis as { DecompressionStream?: new (format: string) => TransformStream<Uint8Array, Uint8Array> }).DecompressionStream;
            if (!inflateCtor) throw new Error('XLSX decompression not supported on this device');
            const stream = new Blob([compressed]).stream().pipeThrough(new inflateCtor('deflate-raw'));
            const inflated = await new Response(stream).arrayBuffer();
            uncompressed = new Uint8Array(inflated);
          } else {
            throw new Error('Unsupported XLSX compression');
          }
          return decoder.decode(uncompressed);
        }

        offset += 46 + fileNameLength + extraLength + commentLength;
      }
      return '';
    };

    const listEntries = () => {
      const entries: string[] = [];
      let offset = centralOffset;
      const centralEnd = centralOffset + centralSize;
      while (offset < centralEnd) {
        if (view.getUint32(offset, true) !== centralSignature) break;
        const fileNameLength = view.getUint16(offset + 28, true);
        const extraLength = view.getUint16(offset + 30, true);
        const commentLength = view.getUint16(offset + 32, true);
        const fileName = decoder.decode(bytes.slice(offset + 46, offset + 46 + fileNameLength));
        entries.push(fileName);
        offset += 46 + fileNameLength + extraLength + commentLength;
      }
      return entries;
    };

    const entries = listEntries();
    const sharedStringsXml = entries.includes('xl/sharedStrings.xml') ? await unzipEntryText('xl/sharedStrings.xml') : '';
    const worksheetPath = entries.includes('xl/worksheets/sheet1.xml')
      ? 'xl/worksheets/sheet1.xml'
      : (entries.find((name) => name.startsWith('xl/worksheets/') && name.endsWith('.xml')) || '');
    if (!worksheetPath) throw new Error('No worksheet found in XLSX');
    const worksheetXml = await unzipEntryText(worksheetPath);

    const parser = new DOMParser();
    const sharedStrings = sharedStringsXml
      ? Array.from(parser.parseFromString(sharedStringsXml, 'application/xml').getElementsByTagName('si')).map((si) =>
          Array.from(si.getElementsByTagName('t')).map((node) => node.textContent || '').join('')
        )
      : [];

    const worksheetDoc = parser.parseFromString(worksheetXml, 'application/xml');
    const rowNodes = Array.from(worksheetDoc.getElementsByTagName('row'));
    const rows = rowNodes.map((rowNode) => {
      const row: string[] = [];
      const cells = Array.from(rowNode.getElementsByTagName('c'));
      cells.forEach((cell) => {
        const ref = cell.getAttribute('r') || '';
        const colLetters = ref.replace(/[0-9]/g, '');
        let colIndex = row.length;
        if (colLetters) {
          colIndex = 0;
          for (let i = 0; i < colLetters.length; i++) {
            colIndex = colIndex * 26 + (colLetters.charCodeAt(i) - 64);
          }
          colIndex -= 1;
        }

        const type = cell.getAttribute('t');
        let value = '';
        if (type === 's') {
          const idx = Number(cell.getElementsByTagName('v')[0]?.textContent || '-1');
          value = idx >= 0 ? String(sharedStrings[idx] || '') : '';
        } else if (type === 'inlineStr') {
          value = Array.from(cell.getElementsByTagName('t')).map((node) => node.textContent || '').join('');
        } else {
          value = cell.getElementsByTagName('v')[0]?.textContent || '';
        }
        row[colIndex] = value.trim();
      });
      return row;
    });

    return rows.filter((row) => row.some((value) => String(value || '').trim()));
  };

  const handleImportInviteFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const resetInput = () => {
      if (inviteFileInputRef.current) inviteFileInputRef.current.value = '';
    };

    try {
      setImportingInvites(true);
      const lowerName = file.name.toLowerCase();
      if (lowerName.endsWith('.xls') && !lowerName.endsWith('.xlsx')) {
        present({ message: 'Legacy .xls is not supported. Use .xlsx or .csv', duration: 2200, color: 'danger' });
        return;
      }
      const imported = lowerName.endsWith('.xlsx')
        ? importInviteRows(await parseXlsxRows(file))
        : importInviteText(await file.text());
      if (!imported) {
        present({ message: 'No valid invite rows found in file', duration: 2200, color: 'danger' });
        return;
      }
      present({ message: `Imported ${imported} invite row(s)`, duration: 2200, color: 'success' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to import invite file';
      present({ message, duration: 2200, color: 'danger' });
    } finally {
      setImportingInvites(false);
      resetInput();
    }
  };

  const downloadInviteTemplate = (format: 'csv' | 'xlsx') => {
    if (format === 'csv') {
      const csv = 'name,phone,email\nAma Serwaa,+233240000001,ama@example.com';
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'invite-template.csv';
      link.click();
      URL.revokeObjectURL(url);
      return;
    }

    const xml = {
      contentTypes: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/>
</Types>`,
      rels: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`,
      workbook: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Invites" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`,
      workbookRels: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/>
</Relationships>`,
      sharedStrings: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="6" uniqueCount="6">
  <si><t>name</t></si>
  <si><t>phone</t></si>
  <si><t>email</t></si>
  <si><t>Ama Serwaa</t></si>
  <si><t>+233240000001</t></si>
  <si><t>ama@example.com</t></si>
</sst>`,
      worksheet: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="s"><v>0</v></c>
      <c r="B1" t="s"><v>1</v></c>
      <c r="C1" t="s"><v>2</v></c>
    </row>
    <row r="2">
      <c r="A2" t="s"><v>3</v></c>
      <c r="B2" t="s"><v>4</v></c>
      <c r="C2" t="s"><v>5</v></c>
    </row>
  </sheetData>
</worksheet>`,
    };

    const files: Array<{ name: string; bytes: Uint8Array }> = [
      { name: '[Content_Types].xml', bytes: new TextEncoder().encode(xml.contentTypes) },
      { name: '_rels/.rels', bytes: new TextEncoder().encode(xml.rels) },
      { name: 'xl/workbook.xml', bytes: new TextEncoder().encode(xml.workbook) },
      { name: 'xl/_rels/workbook.xml.rels', bytes: new TextEncoder().encode(xml.workbookRels) },
      { name: 'xl/sharedStrings.xml', bytes: new TextEncoder().encode(xml.sharedStrings) },
      { name: 'xl/worksheets/sheet1.xml', bytes: new TextEncoder().encode(xml.worksheet) },
    ];

    const crcTable = (() => {
      const table = new Uint32Array(256);
      for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) {
          c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        }
        table[i] = c >>> 0;
      }
      return table;
    })();

    const crc32 = (bytes: Uint8Array) => {
      let crc = 0xffffffff;
      for (let i = 0; i < bytes.length; i++) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ bytes[i]) & 0xff];
      }
      return (crc ^ 0xffffffff) >>> 0;
    };

    const now = new Date();
    const dosTime = ((now.getHours() & 0x1f) << 11) | ((now.getMinutes() & 0x3f) << 5) | ((Math.floor(now.getSeconds() / 2)) & 0x1f);
    const dosDate = (((Math.max(1980, now.getFullYear()) - 1980) & 0x7f) << 9) | (((now.getMonth() + 1) & 0x0f) << 5) | (now.getDate() & 0x1f);

    const encodedFiles = files.map((file) => ({
      nameBytes: new TextEncoder().encode(file.name),
      data: file.bytes,
      crc: crc32(file.bytes),
      offset: 0
    }));

    let localSize = 0;
    encodedFiles.forEach((file) => {
      file.offset = localSize;
      localSize += 30 + file.nameBytes.length + file.data.length;
    });

    let centralSize = 0;
    encodedFiles.forEach((file) => {
      centralSize += 46 + file.nameBytes.length;
    });

    const totalSize = localSize + centralSize + 22;
    const out = new Uint8Array(totalSize);
    const view = new DataView(out.buffer);
    let cursor = 0;

    const writeBytes = (bytes: Uint8Array) => {
      out.set(bytes, cursor);
      cursor += bytes.length;
    };

    encodedFiles.forEach((file) => {
      view.setUint32(cursor, 0x04034b50, true); cursor += 4;
      view.setUint16(cursor, 20, true); cursor += 2;
      view.setUint16(cursor, 0, true); cursor += 2;
      view.setUint16(cursor, 0, true); cursor += 2;
      view.setUint16(cursor, dosTime, true); cursor += 2;
      view.setUint16(cursor, dosDate, true); cursor += 2;
      view.setUint32(cursor, file.crc, true); cursor += 4;
      view.setUint32(cursor, file.data.length, true); cursor += 4;
      view.setUint32(cursor, file.data.length, true); cursor += 4;
      view.setUint16(cursor, file.nameBytes.length, true); cursor += 2;
      view.setUint16(cursor, 0, true); cursor += 2;
      writeBytes(file.nameBytes);
      writeBytes(file.data);
    });

    const centralOffset = cursor;
    encodedFiles.forEach((file) => {
      view.setUint32(cursor, 0x02014b50, true); cursor += 4;
      view.setUint16(cursor, 20, true); cursor += 2;
      view.setUint16(cursor, 20, true); cursor += 2;
      view.setUint16(cursor, 0, true); cursor += 2;
      view.setUint16(cursor, 0, true); cursor += 2;
      view.setUint16(cursor, dosTime, true); cursor += 2;
      view.setUint16(cursor, dosDate, true); cursor += 2;
      view.setUint32(cursor, file.crc, true); cursor += 4;
      view.setUint32(cursor, file.data.length, true); cursor += 4;
      view.setUint32(cursor, file.data.length, true); cursor += 4;
      view.setUint16(cursor, file.nameBytes.length, true); cursor += 2;
      view.setUint16(cursor, 0, true); cursor += 2;
      view.setUint16(cursor, 0, true); cursor += 2;
      view.setUint16(cursor, 0, true); cursor += 2;
      view.setUint16(cursor, 0, true); cursor += 2;
      view.setUint32(cursor, 0, true); cursor += 4;
      view.setUint32(cursor, file.offset, true); cursor += 4;
      writeBytes(file.nameBytes);
    });

    const centralLength = cursor - centralOffset;
    view.setUint32(cursor, 0x06054b50, true); cursor += 4;
    view.setUint16(cursor, 0, true); cursor += 2;
    view.setUint16(cursor, 0, true); cursor += 2;
    view.setUint16(cursor, encodedFiles.length, true); cursor += 2;
    view.setUint16(cursor, encodedFiles.length, true); cursor += 2;
    view.setUint32(cursor, centralLength, true); cursor += 4;
    view.setUint32(cursor, centralOffset, true); cursor += 4;
    view.setUint16(cursor, 0, true); cursor += 2;

    const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'invite-template.xlsx';
    link.click();
    URL.revokeObjectURL(url);
  };

  const syncContacts = async () => {
    const contactPicker = (navigator as Navigator & {
      contacts?: { select: (props: string[], options: { multiple: boolean }) => Promise<Array<{ name?: string[]; email?: string[]; tel?: string[] }>> };
    }).contacts;
    if (!contactPicker?.select) {
      present({ message: 'Contact sync is not supported on this device/browser', duration: 2200, color: 'danger' });
      return;
    }
    try {
      const contacts = await contactPicker.select(['name', 'email', 'tel'], { multiple: true });
      const lines = contacts
        .map((contact) => {
          const name = String(contact.name?.[0] || '').trim();
          const phone = String(contact.tel?.[0] || '').trim();
          const email = String(contact.email?.[0] || '').trim();
          return buildInviteLine(name, phone, email);
        })
        .filter(Boolean);

      if (!lines.length) {
        present({ message: 'No compatible contacts selected', duration: 2200, color: 'danger' });
        return;
      }

      setInviteLines((prev) => {
        const existing = prev
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
        return Array.from(new Set([...existing, ...lines])).join('\n');
      });
      present({ message: `Synced ${lines.length} contact(s)`, duration: 2200, color: 'success' });
    } catch {
      present({ message: 'Contact sync canceled or failed', duration: 2200, color: 'danger' });
    }
  };

  const exportToCsv = (fileName: string, headers: string[], rows: Array<Array<string | number>>) => {
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportRsvps = () => {
    if (!event) return;
    const headers = ['Name', 'Email', 'Phone', 'Attendance', 'Guest Count', 'Status', 'Submitted At'];
    const rows = rsvps.map((item) => [
      item.primaryName,
      item.email || '',
      item.phone || '',
      item.attendance,
      item.guestCount,
      item.status,
      formatDateTime(item.submittedAt)
    ]);
    exportToCsv(`rsvps-${event.slug}.csv`, headers, rows);
  };

  const exportCheckins = () => {
    if (!event) return;
    const headers = ['Guest Name', 'Guest Count', 'Access Code', 'Method', 'Checked In At'];
    const rows = checkins.map((item) => [
      item.invitation.guestName,
      item.invitation.guestCount,
      item.invitation.accessCode,
      item.method,
      formatDateTime(item.checkedInAt)
    ]);
    exportToCsv(`checkins-${event.slug}.csv`, headers, rows);
  };

  const downloadBlob = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const addItinerary = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    if (!eventId) return;
    if (!newItinerary.title.trim()) {
      present({ message: 'Title is required', duration: 1800, color: 'danger' });
      return;
    }
    setSavingItinerary(true);
    try {
      await itineraryApi.createItem(eventId, {
        title: newItinerary.title.trim(),
        description: newItinerary.description || undefined,
        startsAt: showItineraryOptionalFields && newItinerary.startsAt ? new Date(newItinerary.startsAt).toISOString() : undefined,
        endsAt: showItineraryOptionalFields && newItinerary.endsAt ? new Date(newItinerary.endsAt).toISOString() : undefined,
        location: showItineraryOptionalFields ? newItinerary.location || undefined : undefined
      });
      setNewItinerary({ title: '', description: '', startsAt: '', endsAt: '', location: '' });
      setShowItineraryOptionalFields(false);
      present({ message: 'Itinerary item added', duration: 1800, color: 'success' });
      await loadItinerary();
    } catch (error: unknown) {
      toastError(error, 'Failed to add itinerary item');
    } finally {
      setSavingItinerary(false);
    }
  };

  const toggleItineraryItem = async (item: ItineraryItem) => {
    if (!eventId) return;
    try {
      await itineraryApi.updateItem(eventId, item.id, { isCompleted: !item.isCompleted });
      await loadItinerary();
    } catch (error: unknown) {
      toastError(error, 'Failed to update itinerary item');
    }
  };

  const deleteItineraryItem = async (itemId: string) => {
    if (!eventId) return;
    try {
      await itineraryApi.deleteItem(eventId, itemId);
      present({ message: 'Itinerary item deleted', duration: 1800, color: 'success' });
      await loadItinerary();
    } catch (error: unknown) {
      toastError(error, 'Failed to delete itinerary item');
    }
  };

  const reorderItinerary = async (itemId: string, direction: 'up' | 'down') => {
    if (!eventId) return;
    const index = itineraryItems.findIndex((item) => item.id === itemId);
    if (index < 0) return;
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= itineraryItems.length) return;

    const previous = [...itineraryItems];
    const next = [...itineraryItems];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setItineraryItems(next);

    try {
      await itineraryApi.reorderItems(
        eventId,
        next.map((item) => item.id)
      );
    } catch (error: unknown) {
      setItineraryItems(previous);
      toastError(error, 'Failed to reorder itinerary');
    }
  };

  const createMcControlLink = async () => {
    if (!eventId) return;
    setCreatingMcLink(true);
    try {
      const response = await itineraryApi.createMcSession(eventId);
      if (!event?.slug || !response.data.sessionToken) {
        throw new Error('MC token missing');
      }
      setMcControlUrl(`${window.location.origin}/e/${event.slug}/itinerary/mc/${response.data.sessionToken}`);
      present({ message: 'MC control link generated', duration: 1800, color: 'success' });
    } catch (error: unknown) {
      toastError(error, 'Failed to create MC control link');
    } finally {
      setCreatingMcLink(false);
    }
  };

  const addDomain = async () => {
    if (!eventId || !domainHost.trim()) {
      present({ message: 'Domain host is required', duration: 1800, color: 'danger' });
      return;
    }
    setSavingDomain(true);
    try {
      await ownerDashboardApi.addDomain(eventId, domainHost.trim());
      setDomainHost('');
      present({ message: 'Domain added', duration: 1800, color: 'success' });
      await loadDomains();
    } catch (error: unknown) {
      toastError(error, 'Failed to add domain');
    } finally {
      setSavingDomain(false);
    }
  };

  const verifyDomain = async (domainId: string) => {
    if (!eventId) return;
    try {
      await ownerDashboardApi.verifyDomain(eventId, domainId);
      await loadDomains();
    } catch (error: unknown) {
      toastError(error, 'Failed to verify domain');
    }
  };

  const makePrimaryDomain = async (domainId: string) => {
    if (!eventId) return;
    try {
      await ownerDashboardApi.setPrimaryDomain(eventId, domainId);
      await loadDomains();
    } catch (error: unknown) {
      toastError(error, 'Failed to set primary domain');
    }
  };

  const removeDomain = async (domainId: string) => {
    if (!eventId) return;
    try {
      await ownerDashboardApi.deleteDomain(eventId, domainId);
      await loadDomains();
    } catch (error: unknown) {
      toastError(error, 'Failed to remove domain');
    }
  };

  const sendInvites = async () => {
    if (!eventId) return;
    const parsed = parseInviteLines(inviteLines);
    if (!parsed.length) {
      present({ message: 'Add at least one invite line', duration: 1800, color: 'danger' });
      return;
    }

    try {
      setValidatingInvites(true);
      const preview = await ownerDashboardApi.validateInvites(eventId, parsed, inviteChannel);
      setInviteValidation(preview.data.summary);
      if (!preview.data.summary.valid) {
        present({
          message: 'No valid invites after validation. Fix duplicates/invalid rows.',
          duration: 2200,
          color: 'danger'
        });
        return;
      }
    } catch (error: unknown) {
      toastError(error, 'Failed to validate invites');
      return;
    } finally {
      setValidatingInvites(false);
    }

    setSendingInvites(true);
    try {
      const response = await ownerDashboardApi.sendInvites(eventId, {
        invites: parsed,
        expiresInHours: inviteExpiryHours,
        channel: inviteChannel,
      });
      setInviteLines('');
      setInviteValidation({
        total: Number(response.data.totalCount || parsed.length),
        valid: Number(response.data.sentCount || 0),
        invalid: Number(response.data.failedCount || 0),
        duplicates: Number(response.data.skippedCount || 0),
      });
      present({
        message: `Sent ${String(response.data.sentCount || 0)} invite(s), skipped ${String(response.data.skippedCount || 0)}`,
        duration: 2200,
        color: 'success'
      });
      await loadInvites();
    } catch (error: unknown) {
      toastError(error, 'Failed to send invites');
    } finally {
      setSendingInvites(false);
    }
  };

  const resendInvite = async (inviteId: string) => {
    if (!eventId) return;
    try {
      await ownerDashboardApi.resendInvite(eventId, inviteId);
      await loadInvites();
    } catch (error: unknown) {
      toastError(error, 'Failed to resend invite');
    }
  };

  const toggleSelectMedia = (mediaId: string) => {
    setSelectedMediaIds((prev) =>
      prev.includes(mediaId) ? prev.filter((id) => id !== mediaId) : [...prev, mediaId]
    );
  };

  const deleteSelectedMedia = async () => {
    if (!selectedMediaIds.length) return;
    setDeletingMedia(true);
    try {
      await ownerDashboardApi.bulkDeleteMedia(selectedMediaIds);
      present({ message: `${selectedMediaIds.length} item(s) deleted`, duration: 1800, color: 'success' });
      setSelectedMediaIds([]);
      setMediaSelectMode(false);
      await loadMedia();
    } catch (error: unknown) {
      toastError(error, 'Failed to delete media');
    } finally {
      setDeletingMedia(false);
    }
  };

  const deleteSingleMedia = async (mediaId: string) => {
    setDeletingMedia(true);
    try {
      await ownerDashboardApi.deleteMedia(mediaId);
      present({ message: 'Media deleted', duration: 1800, color: 'success' });
      await loadMedia();
    } catch (error: unknown) {
      toastError(error, 'Failed to delete media');
    } finally {
      setDeletingMedia(false);
    }
  };

  const downloadSingleMedia = async (asset: MediaAsset) => {
    setDownloadingMedia(true);
    try {
      const response = await ownerDashboardApi.downloadMedia(asset.id);
      downloadBlob(response.data, asset.fileName || `media-${asset.id}`);
    } catch (error: unknown) {
      toastError(error, 'Failed to download media');
    } finally {
      setDownloadingMedia(false);
    }
  };

  const downloadAlbum = async (type?: 'PHOTO' | 'VIDEO' | 'AUDIO') => {
    if (!eventId) return;
    setDownloadingMedia(true);
    try {
      const response = await ownerDashboardApi.downloadAllMedia(eventId, type);
      const suffix = type ? type.toLowerCase() : 'all-media';
      const fileName = `${event?.slug || 'event'}-${suffix}.zip`;
      downloadBlob(response.data, fileName);
    } catch (error: unknown) {
      toastError(error, 'Failed to download media album');
    } finally {
      setDownloadingMedia(false);
    }
  };

  const inviteStats = useMemo(() => {
    return invites.reduce(
      (acc, invite) => {
        acc.total += 1;
        if (invite.status === 'SENT') acc.sent += 1;
        if (invite.status === 'OPENED') acc.opened += 1;
        if (invite.status === 'RESPONDED') acc.responded += 1;
        if (invite.status === 'EXPIRED') acc.expired += 1;
        return acc;
      },
      { total: 0, sent: 0, opened: 0, responded: 0, expired: 0 }
    );
  }, [invites]);

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/app/events" />
          </IonButtons>
          <IonTitle>{event?.name || 'Event details'}</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonRefresher slot="fixed" onIonRefresh={(refresh) => onRefresh().finally(() => refresh.detail.complete())}>
          <IonRefresherContent />
        </IonRefresher>
        <main className="screen-content">
          {!loading && event ? (
            <>
              <section className="hero-card compact">
                <div className="row-between">
                  <p className="eyebrow">Event</p>
                  <span className={'phase-chip phase-' + String(event.currentPhase).toLowerCase()}>{phaseLabel(event.currentPhase)}</span>
                </div>
                <h2>{event.name}</h2>
                <p className="event-subline">{formatDateTime(event.date)}{event.venue ? ' \u00b7 ' + event.venue : ''}</p>
                <IonButton size="small" fill="outline" onClick={copyEventLink}>Copy public link</IonButton>
              </section>

              <section className="surface-card">
                <IonSegment scrollable={true} value={activeTab} onIonChange={(segmentEvent) => setActiveTab((segmentEvent.detail.value as EventTab) || 'overview')}>
                  <IonSegmentButton value="overview">Overview</IonSegmentButton>
                  <IonSegmentButton value="rsvps">RSVPs {tabCounts.rsvps}</IonSegmentButton>
                  <IonSegmentButton value="checkin">Check-in {tabCounts.checkin}</IonSegmentButton>
                  <IonSegmentButton value="media">Media {tabCounts.media}</IonSegmentButton>
                  <IonSegmentButton value="tickets">Tickets {tabCounts.tickets}</IonSegmentButton>
                  <IonSegmentButton value="itinerary">Itinerary {tabCounts.itinerary}</IonSegmentButton>
                  <IonSegmentButton value="invites">Invites {tabCounts.invites}</IonSegmentButton>
                  <IonSegmentButton value="domains">Domains {tabCounts.domains}</IonSegmentButton>
                  <IonSegmentButton value="gifts">Gifts {tabCounts.gifts}</IonSegmentButton>
                </IonSegment>
              </section>

              {activeTab === 'overview' ? (
                <>
                  <div className="metric-grid">
                    <article className="surface-card metric-card">
                      <p className="metric-label">RSVPs</p>
                      <p className="metric-value">{event._count.rsvps}</p>
                    </article>
                    <article className="surface-card metric-card">
                      <p className="metric-label">Check-ins</p>
                      <p className="metric-value">{event._count.checkIns}</p>
                    </article>
                    <article className="surface-card metric-card">
                      <p className="metric-label">Media</p>
                      <p className="metric-value">{event._count.mediaAssets}</p>
                    </article>
                    <article className="surface-card metric-card">
                      <p className="metric-label">Invites</p>
                      <p className="metric-value">{event._count.invitations}</p>
                    </article>
                  </div>

                  <section className="surface-card">
                    <h3>Event status</h3>
                    <div className="event-list">
                      <article className="event-list-item static stack">
                        <div className="row-between">
                          <p className="event-title">Approval</p>
                          <span className={'status-pill ' + statusToneClass(event.approvalStatus || 'APPROVED')}>
                            {event.approvalStatus || 'APPROVED'}
                          </span>
                        </div>
                        <p className="event-subline">Currency: {event.defaultCurrency || 'USD'} &middot; Submitted: {formatDate(event.approvalSubmittedAt || event.date)}</p>
                        {event.approvalRejectionReason ? (
                          <p className="event-subline">Feedback: {event.approvalRejectionReason}</p>
                        ) : null}
                      </article>
                    </div>
                  </section>

                  <section className="surface-card">
                    <h3>Shareable links</h3>
                    <div className="inline-row wrap">
                      <IonButton size="small" fill="outline" onClick={() => copyShareLink(`/e/${event.slug}/rsvp`, 'RSVP')}>
                        Copy RSVP link
                      </IonButton>
                      <IonButton size="small" fill="outline" onClick={() => copyShareLink(`/gift/${event.slug}`, 'Gift')}>
                        Copy Gift link
                      </IonButton>
                      <IonButton size="small" fill="outline" onClick={() => copyShareLink(`/e/${event.slug}/itinerary`, 'Itinerary')}>
                        Copy Itinerary link
                      </IonButton>
                    </div>
                  </section>
                </>
              ) : null}

              {activeTab === 'rsvps' ? (
                <section className="surface-card">
                  <div className="row-between">
                    <h3>RSVP Reviews</h3>
                    <IonButton size="small" fill="outline" onClick={exportRsvps}>Export CSV</IonButton>
                  </div>
                  <IonSegment scrollable={true} value={rsvpFilter} onIonChange={(segmentEvent) => setRsvpFilter((segmentEvent.detail.value as string) || 'all')}>
                    <IonSegmentButton value="all">All</IonSegmentButton>
                    <IonSegmentButton value="PENDING">Pending</IonSegmentButton>
                    <IonSegmentButton value="APPROVED">Approved</IonSegmentButton>
                    <IonSegmentButton value="REJECTED">Rejected</IonSegmentButton>
                  </IonSegment>
                  {!rsvps.length ? <p className="muted-text">No RSVPs found.</p> : null}
                  <div className="event-list">
                    {rsvps.map((rsvp) => (
                      <article className="event-list-item static stack" key={rsvp.id}>
                        <div className="row-between">
                          <div className="inline-row" style={{ gap: 10 }}>
                            <div className="avatar-circle sm">{(rsvp.primaryName || '?').charAt(0).toUpperCase()}</div>
                            <p className="event-title">{rsvp.primaryName}</p>
                          </div>
                          <span className={'status-pill ' + statusToneClass(rsvp.status)}>{rsvp.status}</span>
                        </div>
                        <p className="event-subline">{rsvp.attendance} \u00b7 {rsvp.guestCount} guest(s) \u00b7 {formatDateTime(rsvp.submittedAt)}</p>
                        <p className="event-subline">{rsvp.email || rsvp.phone || '-'}</p>
                        <div className="inline-row wrap">
                          <IonButton
                            size="small"
                            color="success"
                            fill="outline"
                            disabled={reviewingRsvpId === rsvp.id || rsvp.status === 'APPROVED'}
                            onClick={() => reviewRsvp(rsvp.id, 'APPROVED')}
                          >
                            Approve
                          </IonButton>
                          <IonButton
                            size="small"
                            color="danger"
                            fill="outline"
                            disabled={reviewingRsvpId === rsvp.id || rsvp.status === 'REJECTED'}
                            onClick={() => reviewRsvp(rsvp.id, 'REJECTED')}
                          >
                            Reject
                          </IonButton>
                          <IonButton
                            size="small"
                            fill="outline"
                            disabled={reviewingRsvpId === rsvp.id || rsvp.status === 'PENDING'}
                            onClick={() => reviewRsvp(rsvp.id, 'PENDING')}
                          >
                            Set pending
                          </IonButton>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {activeTab === 'checkin' ? (
                <section className="surface-card">
                  <div className="row-between">
                    <h3>Check-ins</h3>
                    <IonButton size="small" fill="outline" onClick={exportCheckins}>Export CSV</IonButton>
                  </div>
                  {!checkins.length ? <p className="muted-text">No check-ins yet.</p> : null}
                  <div className="event-list">
                    {checkins.map((checkin) => (
                      <article className="event-list-item static stack" key={checkin.id}>
                        <p className="event-title">{checkin.invitation.guestName}</p>
                        <p className="event-subline">Guests: {checkin.invitation.guestCount} - Code: {checkin.invitation.accessCode}</p>
                        <p className="event-subline">{formatDateTime(checkin.checkedInAt)} - {checkin.method}</p>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {activeTab === 'media' ? (
                <section className="surface-card">
                  <div className="row-between">
                    <h3>Guestbook Media</h3>
                    <div className="inline-row wrap">
                      <IonButton size="small" fill="outline" disabled={downloadingMedia} onClick={() => downloadAlbum()}>
                        Download all
                      </IonButton>
                      <IonButton
                        size="small"
                        fill="outline"
                        onClick={() => {
                          setMediaSelectMode((prev) => !prev);
                          setSelectedMediaIds([]);
                        }}
                      >
                        {mediaSelectMode ? 'Cancel select' : 'Select'}
                      </IonButton>
                    </div>
                  </div>
                  <div className="inline-row wrap">
                    <span className="status-pill tone-info">Photos: {mediaAlbums.photos.length}</span>
                    <span className="status-pill tone-warning">Videos: {mediaAlbums.videos.length}</span>
                    <span className="status-pill tone-neutral">Audio: {mediaAlbums.audios.length}</span>
                  </div>
                  <IonSegment
                    scrollable={true}
                    value={mediaFilter}
                    onIonChange={(segmentEvent) =>
                      setMediaFilter((segmentEvent.detail.value as 'ALL' | 'PHOTO' | 'VIDEO' | 'AUDIO') || 'ALL')
                    }
                  >
                    <IonSegmentButton value="ALL">All</IonSegmentButton>
                    <IonSegmentButton value="PHOTO">Photos</IonSegmentButton>
                    <IonSegmentButton value="VIDEO">Videos</IonSegmentButton>
                    <IonSegmentButton value="AUDIO">Audio</IonSegmentButton>
                  </IonSegment>
                  {mediaSelectMode && selectedMediaIds.length > 0 ? (
                    <div className="inline-row wrap">
                      <span className="muted-text">{selectedMediaIds.length} selected</span>
                      <IonButton size="small" color="danger" fill="outline" disabled={deletingMedia} onClick={deleteSelectedMedia}>
                        {deletingMedia ? 'Deleting...' : 'Delete selected'}
                      </IonButton>
                    </div>
                  ) : null}
                  {!filteredMedia.length ? <p className="muted-text">No media uploaded yet.</p> : null}
                  <div className="event-list">
                    {filteredMedia.map((asset) => (
                      <article className="event-list-item static stack" key={asset.id}>
                        <div className="row-between">
                          <div className="inline-row">
                            {mediaSelectMode ? (
                              <input
                                type="checkbox"
                                checked={selectedMediaIds.includes(asset.id)}
                                onChange={() => toggleSelectMedia(asset.id)}
                              />
                            ) : null}
                            <p className="event-title">{asset.fileName}</p>
                          </div>
                          <span className={'status-pill tone-info'}>{asset.type}</span>
                        </div>
                        <p className="event-subline">Guest: {asset.guestName || 'Unknown'} - {formatDateTime(asset.createdAt)}</p>
                        {String(asset.type).toUpperCase() === 'PHOTO' ? (
                          <button className="inline-link" onClick={() => setLightboxPhoto(asset)}>
                            Open photo
                          </button>
                        ) : null}
                        {String(asset.type).toUpperCase() === 'VIDEO' ? (
                          <video controls preload="metadata" style={{ width: '100%', borderRadius: 12 }}>
                            <source src={asset.filePath} />
                          </video>
                        ) : null}
                        {String(asset.type).toUpperCase() === 'AUDIO' ? (
                          <audio controls preload="metadata" style={{ width: '100%' }}>
                            <source src={asset.filePath} />
                          </audio>
                        ) : null}
                        <div className="inline-row wrap">
                          <IonButton size="small" fill="outline" disabled={downloadingMedia} onClick={() => downloadSingleMedia(asset)}>
                            Download
                          </IonButton>
                          <IonButton size="small" color="danger" fill="outline" disabled={deletingMedia} onClick={() => deleteSingleMedia(asset.id)}>
                            Delete
                          </IonButton>
                        </div>
                      </article>
                    ))}
                  </div>
                  {lightboxPhoto ? (
                    <div className="surface-card">
                      <div className="row-between">
                        <h3>{lightboxPhoto.fileName}</h3>
                        <IonButton size="small" fill="clear" onClick={() => setLightboxPhoto(null)}>Close</IonButton>
                      </div>
                      <img
                        src={lightboxPhoto.filePath}
                        alt={lightboxPhoto.fileName}
                        style={{ width: '100%', borderRadius: 14 }}
                      />
                    </div>
                  ) : null}
                </section>
              ) : null}

              {activeTab === 'tickets' ? (
                <section className="surface-card">
                  <h3>Ticket Performance</h3>
                  {!tickets.length ? <p className="muted-text">No tickets configured.</p> : null}
                  <div className="event-list">
                    {tickets.map((ticket) => (
                      <article className="event-list-item static stack" key={ticket.id}>
                        <div className="row-between">
                          <p className="event-title">{ticket.name}</p>
                          <span className={'status-pill ' + (ticket.isActive ? 'tone-success' : 'tone-neutral')}>
                            {ticket.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="event-subline">{ticket.price > 0 ? formatCurrency(ticket.currency, ticket.price) : 'Free'}</p>
                        <p className="event-subline">Sold: {ticket.quantitySold} / {ticket.quantityTotal}</p>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}

              {activeTab === 'itinerary' ? (
                <>
                  <section className="surface-card">
                    <div className="row-between">
                      <h3>Itinerary</h3>
                      <IonButton size="small" fill="outline" disabled={creatingMcLink} onClick={createMcControlLink}>
                        {creatingMcLink ? 'Creating...' : 'Create MC control link'}
                      </IonButton>
                    </div>
                    {mcControlUrl ? (
                      <div className="inline-row wrap">
                        <a href={mcControlUrl} target="_blank" rel="noreferrer" className="inline-link">Open MC link</a>
                        <IonButton size="small" fill="clear" onClick={copyMcLink}>Copy MC link</IonButton>
                      </div>
                    ) : null}
                    <form className="auth-form" onSubmit={addItinerary}>
                      <label className="field">
                        <span>Title</span>
                        <input className="native-input" required value={newItinerary.title} onChange={(inputEvent) => setNewItinerary((prev) => ({ ...prev, title: inputEvent.target.value }))} />
                      </label>
                      <label className="field">
                        <span>Description</span>
                        <textarea className="native-input native-textarea" value={newItinerary.description} onChange={(inputEvent) => setNewItinerary((prev) => ({ ...prev, description: inputEvent.target.value }))} />
                      </label>
                      <IonButton
                        size="small"
                        fill="outline"
                        type="button"
                        onClick={() => setShowItineraryOptionalFields((prev) => !prev)}
                      >
                        {showItineraryOptionalFields ? 'Hide optional date/time/location' : 'Add optional date/time/location'}
                      </IonButton>
                      {showItineraryOptionalFields ? (
                        <>
                          <label className="field">
                            <span>Starts at (optional)</span>
                            <input className="native-input" type="datetime-local" value={newItinerary.startsAt} onChange={(inputEvent) => setNewItinerary((prev) => ({ ...prev, startsAt: inputEvent.target.value }))} />
                          </label>
                          <label className="field">
                            <span>Ends at (optional)</span>
                            <input className="native-input" type="datetime-local" value={newItinerary.endsAt} onChange={(inputEvent) => setNewItinerary((prev) => ({ ...prev, endsAt: inputEvent.target.value }))} />
                          </label>
                          <label className="field">
                            <span>Location (optional)</span>
                            <input className="native-input" value={newItinerary.location} onChange={(inputEvent) => setNewItinerary((prev) => ({ ...prev, location: inputEvent.target.value }))} />
                          </label>
                        </>
                      ) : null}
                      <IonButton className="solid-cta" type="submit" expand="block" disabled={savingItinerary}>
                        {savingItinerary ? 'Adding...' : 'Add itinerary item'}
                      </IonButton>
                    </form>
                  </section>

                  <section className="surface-card">
                    <h3>Timeline items</h3>
                    {!itineraryItems.length ? <p className="muted-text">No itinerary items yet.</p> : null}
                    <div className="event-list">
                      {itineraryItems.map((item, index) => (
                        <article className="event-list-item static stack" key={item.id}>
                          <div className="row-between">
                            <p className="event-title">{item.title}</p>
                            <span className={'status-pill ' + (item.isCompleted ? 'tone-success' : 'tone-neutral')}>
                              {item.isCompleted ? 'Completed' : 'Pending'}
                            </span>
                          </div>
                          <p className="event-subline">
                            {formatDateTime(item.startsAt)} {item.location ? '- ' + item.location : ''}
                          </p>
                          {item.description ? <p className="event-subline">{item.description}</p> : null}
                          <div className="inline-row wrap">
                            <IonButton size="small" fill="outline" onClick={() => toggleItineraryItem(item)}>
                              {item.isCompleted ? 'Mark pending' : 'Mark completed'}
                            </IonButton>
                            <IonButton size="small" fill="outline" disabled={index === 0} onClick={() => reorderItinerary(item.id, 'up')}>
                              Move up
                            </IonButton>
                            <IonButton size="small" fill="outline" disabled={index === itineraryItems.length - 1} onClick={() => reorderItinerary(item.id, 'down')}>
                              Move down
                            </IonButton>
                            <IonButton size="small" color="danger" fill="outline" onClick={() => deleteItineraryItem(item.id)}>
                              Delete
                            </IonButton>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                </>
              ) : null}

              {activeTab === 'invites' ? (
                <>
                  <section className="surface-card">
                    <h3>Bulk invite studio</h3>
                    <p className="muted-text">Paste invite lines, import CSV/XLSX, or sync device contacts.</p>
                    <div className="inline-row wrap">
                      <span className="status-pill tone-neutral">Total: {inviteStats.total}</span>
                      <span className="status-pill tone-warning">Sent: {inviteStats.sent}</span>
                      <span className="status-pill tone-info">Opened: {inviteStats.opened}</span>
                      <span className="status-pill tone-success">Responded: {inviteStats.responded}</span>
                      <span className="status-pill tone-danger">Expired: {inviteStats.expired}</span>
                    </div>
                    {inviteValidation ? (
                      <div className="inline-row wrap">
                        <span className="status-pill tone-neutral">Parsed: {inviteValidation.total}</span>
                        <span className="status-pill tone-success">Valid: {inviteValidation.valid}</span>
                        <span className="status-pill tone-danger">Invalid: {inviteValidation.invalid}</span>
                        <span className="status-pill tone-warning">Duplicates: {inviteValidation.duplicates}</span>
                      </div>
                    ) : null}
                    <label className="field">
                      <span>Send via</span>
                      <select
                        className="native-select"
                        value={inviteChannel}
                        onChange={(inputEvent) => setInviteChannel((inputEvent.target.value as 'whatsapp' | 'email' | 'both') || 'whatsapp')}
                      >
                        <option value="whatsapp">WhatsApp</option>
                        <option value="email">Email</option>
                        <option value="both">Both</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Invite lines</span>
                      <div className="inline-row wrap">
                        <IonButton size="small" fill="outline" onClick={syncContacts}>
                          Sync contacts
                        </IonButton>
                        <IonButton
                          size="small"
                          fill="outline"
                          disabled={importingInvites}
                          onClick={() => inviteFileInputRef.current?.click()}
                        >
                          {importingInvites ? 'Importing...' : 'Import CSV/XLSX'}
                        </IonButton>
                        <IonButton size="small" fill="clear" onClick={() => downloadInviteTemplate('csv')}>
                          CSV template
                        </IonButton>
                        <IonButton size="small" fill="clear" onClick={() => downloadInviteTemplate('xlsx')}>
                          XLSX template
                        </IonButton>
                        <input
                          ref={inviteFileInputRef}
                          type="file"
                          accept=".csv,.xlsx,.xls,text/csv"
                          style={{ display: 'none' }}
                          onChange={handleImportInviteFile}
                        />
                      </div>
                      <textarea
                        className="native-input native-textarea"
                        value={inviteLines}
                        placeholder={
                          inviteChannel === 'whatsapp'
                            ? '+233xxxxxxxxx\nAma,+233xxxxxxxxx,ama@email.com'
                            : inviteChannel === 'email'
                              ? 'ama@email.com\nAma,ama@email.com'
                              : 'Ama,+233xxxxxxxxx,ama@email.com'
                        }
                        onChange={(inputEvent) => setInviteLines(inputEvent.target.value)}
                      />
                      <p className="muted-text">
                        {inviteChannel === 'whatsapp' ? 'Format: phone or name,phone or name,phone,email' : null}
                        {inviteChannel === 'email' ? 'Format: email or name,email' : null}
                        {inviteChannel === 'both' ? 'Format: name,phone,email (both required)' : null}
                      </p>
                    </label>
                    <label className="field">
                      <span>Expiry (hours)</span>
                      <select className="native-select" value={inviteExpiryHours} onChange={(inputEvent) => setInviteExpiryHours(Number(inputEvent.target.value || 240))}>
                        <option value={24}>24 hours</option>
                        <option value={72}>3 days</option>
                        <option value={168}>7 days</option>
                        <option value={240}>10 days</option>
                        <option value={720}>30 days</option>
                      </select>
                    </label>
                    <IonButton className="solid-cta" expand="block" disabled={sendingInvites || validatingInvites} onClick={sendInvites}>
                      {validatingInvites ? 'Validating...' : sendingInvites ? 'Sending...' : 'Validate and send invites'}
                    </IonButton>
                  </section>

                  <section className="surface-card">
                    <h3>Invite status list</h3>
                    {!invites.length ? <p className="muted-text">No invites yet.</p> : null}
                    <div className="event-list">
                      {invites.map((invite) => (
                        <article className="event-list-item static stack" key={invite.id}>
                          <div className="row-between">
                            <p className="event-title">{invite.inviteeName || '-'}</p>
                            <span className={'status-pill ' + statusToneClass(invite.status)}>{invite.status}</span>
                          </div>
                          <p className="event-subline">{invite.inviteePhone || invite.inviteeEmail || '-'}</p>
                          <p className="event-subline">Channel: {(invite.channel || 'whatsapp').toUpperCase()}</p>
                          <p className="event-subline">Sent: {formatDate(invite.sentAt || invite.createdAt)} - Expires: {formatDate(invite.expiresAt)}</p>
                          <div className="inline-row">
                            <IonButton size="small" fill="outline" onClick={() => resendInvite(invite.id)} disabled={invite.status === 'RESPONDED'}>
                              Resend
                            </IonButton>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                </>
              ) : null}

              {activeTab === 'domains' ? (
                <>
                  <section className="surface-card">
                    <h3>Custom domains</h3>
                    <p className="muted-text">Connect your event domain with TXT + CNAME records.</p>
                    <div className="inline-row wrap">
                      <input className="native-input inline-input" placeholder="wedding.example.com" value={domainHost} onChange={(inputEvent) => setDomainHost(inputEvent.target.value)} />
                      <IonButton className="solid-cta" disabled={savingDomain} onClick={addDomain}>
                        {savingDomain ? 'Adding...' : 'Add domain'}
                      </IonButton>
                    </div>
                  </section>

                  <section className="surface-card">
                    <h3>Domain records</h3>
                    {!domains.length ? <p className="muted-text">No domains connected.</p> : null}
                    <div className="event-list">
                      {domains.map((domain) => (
                        <article className="event-list-item static stack" key={domain.id}>
                          <div className="row-between">
                            <p className="event-title">{domain.host}</p>
                            <div className="inline-row">
                              {domain.isPrimary ? <span className="status-pill tone-info">Primary</span> : null}
                              <span className={'status-pill ' + statusToneClass(domain.status)}>{domain.status}</span>
                            </div>
                          </div>
                          <p className="event-subline">TXT: _eventpeepo.{domain.host} = {domain.verificationToken}</p>
                          <p className="event-subline">CNAME: {domain.host.startsWith('www.') ? domain.host : `www.${domain.host}`} = {cnameTarget}</p>
                          {domain.verificationNotes ? <p className="event-subline">{domain.verificationNotes}</p> : null}
                          <div className="inline-row wrap">
                            <IonButton size="small" fill="outline" onClick={() => verifyDomain(domain.id)}>Verify</IonButton>
                            {!domain.isPrimary ? (
                              <IonButton size="small" fill="outline" disabled={!['VERIFIED', 'ACTIVE'].includes(domain.status)} onClick={() => makePrimaryDomain(domain.id)}>
                                Make primary
                              </IonButton>
                            ) : null}
                            <IonButton size="small" color="danger" fill="outline" onClick={() => removeDomain(domain.id)}>Remove</IonButton>
                          </div>
                        </article>
                      ))}
                    </div>
                  </section>
                </>
              ) : null}

              {activeTab === 'gifts' ? (
                <section className="surface-card">
                  <h3>Gift orders</h3>
                  {!giftOrders.length ? <p className="muted-text">No gift orders yet.</p> : null}
                  <div className="event-list">
                    {giftOrders.map((order) => (
                      <article className="event-list-item static stack" key={order.id}>
                        <div className="row-between">
                          <p className="event-title">{order.guestName}</p>
                          <span className={'status-pill ' + statusToneClass(order.status)}>{order.status}</span>
                        </div>
                        <p className="event-subline">
                          Total: {formatCurrency(order.currency, order.totalAmount)} - Net: {formatCurrency(order.currency, order.ownerNetAmount)}
                        </p>
                        <p className="event-subline">{order.guestEmail || order.guestPhone || '-'}</p>
                        <p className="event-subline">{formatDateTime(order.createdAt)}</p>
                      </article>
                    ))}
                  </div>
                </section>
              ) : null}
            </>
          ) : (
            <section className="surface-card">
              <p className="muted-text">{loading ? 'Loading event...' : 'Event unavailable.'}</p>
            </section>
          )}
        </main>
      </IonContent>
    </IonPage>
  );
};

export default EventDetailsPage;
