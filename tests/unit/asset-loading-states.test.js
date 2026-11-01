import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import AssetLoadingState from '@/components/ui/AssetLoadingState';
import ImageWithLoading from '@/components/ui/ImageWithLoading';
import DocumentPreviewWithLoading from '@/components/ui/DocumentPreviewWithLoading';

describe('Asset Loading States & Components Unit Tests', () => {
  describe('AssetLoadingState accessible loading indicators', () => {
    it('renders with role="status" and aria-live="polite" for screen readers', () => {
      const html = renderToStaticMarkup(
        React.createElement(AssetLoadingState, { label: 'Loading student record...' })
      );
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-live="polite"');
      expect(html).toContain('Loading student record...');
    });

    it('renders avatar variant with user silhouette and pulse animation', () => {
      const html = renderToStaticMarkup(
        React.createElement(AssetLoadingState, { variant: 'avatar', className: 'rounded-full' })
      );
      expect(html).toContain('rounded-full');
      expect(html).toContain('animate-pulse');
      expect(html).toContain('Loading...');
    });

    it('renders signature variant with rectangular aspect ratio and spinner', () => {
      const html = renderToStaticMarkup(
        React.createElement(AssetLoadingState, { variant: 'signature', label: 'Verifying Specimen Signature...' })
      );
      expect(html).toContain('animate-pulse');
      expect(html).toContain('Verifying Specimen Signature...');
    });

    it('renders document variant with file indicator icon and descriptive label', () => {
      const html = renderToStaticMarkup(
        React.createElement(AssetLoadingState, { variant: 'document', label: 'Fetching official transcript...' })
      );
      expect(html).toContain('Fetching official transcript...');
      expect(html).toContain('Retrieving official student record');
      expect(html).toContain('svg');
    });

    it('renders spinner variant with institutional Kakatiya blue', () => {
      const html = renderToStaticMarkup(
        React.createElement(AssetLoadingState, { variant: 'spinner', size: 'lg' })
      );
      expect(html).toContain('animate-spin');
      expect(html).toContain('border-t-[#0b3578]');
    });
  });

  describe('ImageWithLoading Component', () => {
    it('renders fallback when src is falsy', () => {
      const html = renderToStaticMarkup(
        React.createElement(ImageWithLoading, { src: null, alt: 'Student Profile', emptyText: 'No Photo' })
      );
      expect(html).toContain('No Photo');
    });

    it('renders custom fallbackAvatar when src is missing', () => {
      const html = renderToStaticMarkup(
        React.createElement(ImageWithLoading, {
          src: '',
          alt: 'Student',
          fallbackAvatar: React.createElement('div', { 'data-testid': 'custom-avatar' }, 'CUSTOM_AVATAR'),
        })
      );
      expect(html).toContain('CUSTOM_AVATAR');
    });

    it('renders image wrapper and Next.js Image element when src is provided', () => {
      const html = renderToStaticMarkup(
        React.createElement(ImageWithLoading, {
          src: 'kucet/staff/pfp/abc.webp',
          alt: 'Staff Avatar',
          width: 120,
          height: 120,
          variant: 'avatar',
        })
      );
      expect(html).toContain('img');
      expect(html).toContain('alt="Staff Avatar"');
    });

    it('handles base64 data URLs cleanly without resolving via asset path', () => {
      const dataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      const html = renderToStaticMarkup(
        React.createElement(ImageWithLoading, {
          src: dataUri,
          alt: 'Base64 Preview',
          width: 64,
          height: 64,
        })
      );
      expect(html).toContain('data:image/png;base64');
    });

    it('guarantees container has w-full h-full when fill=true to prevent collapse', () => {
      const html = renderToStaticMarkup(
        React.createElement(ImageWithLoading, {
          src: 'kucet/students/pfp/stu1.webp',
          alt: 'Profile Photo',
          fill: true,
          variant: 'avatar',
          className: 'object-cover',
        })
      );
      expect(html).toContain('w-full h-full');
      expect(html).toContain('object-cover');
    });

    it('derives object-contain for signature variant to prevent distorted thin strips', () => {
      const html = renderToStaticMarkup(
        React.createElement(ImageWithLoading, {
          src: 'kucet/students/signatures/sig1.png',
          alt: 'Signature Preview',
          fill: true,
          variant: 'signature',
        })
      );
      expect(html).toContain('object-contain');
      expect(html).toContain('w-full h-full');
    });

    it('derives object-contain for document variant and respects custom imageClassName', () => {
      const html = renderToStaticMarkup(
        React.createElement(ImageWithLoading, {
          src: 'kucet/certificates/payments/pay1.webp',
          alt: 'Payment Screenshot',
          fill: true,
          variant: 'document',
          imageClassName: 'max-h-[80vh]',
        })
      );
      expect(html).toContain('object-contain');
      expect(html).toContain('max-h-[80vh]');
    });

    it('renders empty fallback with w-full h-full when fill=true and src is missing', () => {
      const html = renderToStaticMarkup(
        React.createElement(ImageWithLoading, {
          src: null,
          fill: true,
          variant: 'signature',
          emptyText: 'None',
        })
      );
      expect(html).toContain('w-full h-full');
      expect(html).toContain('None');
    });
  });

  describe('DocumentPreviewWithLoading Component', () => {
    it('renders empty fallback when src is missing', () => {
      const html = renderToStaticMarkup(
        React.createElement(DocumentPreviewWithLoading, { src: null, title: 'Proof Document' })
      );
      expect(html).toContain('No Document Available');
    });

    it('identifies PDF files and renders iframe with toolbar', () => {
      const html = renderToStaticMarkup(
        React.createElement(DocumentPreviewWithLoading, {
          src: 'kucet/documents/transcripts/student_101.pdf',
          title: 'Official Transcript',
          allowDownload: true,
          allowExternal: true,
        })
      );
      expect(html).toContain('iframe');
      expect(html).toContain('title="Official Transcript"');
      expect(html).toContain('Open in New Tab');
      expect(html).toContain('Download');
    });

    it('identifies image files and renders full-size responsive ImageWithLoading', () => {
      const html = renderToStaticMarkup(
        React.createElement(DocumentPreviewWithLoading, {
          src: 'kucet/documents/receipts/challan_882.webp',
          title: 'Fee Challan Receipt',
        })
      );
      expect(html).toContain('img');
      expect(html).toContain('Open in New Tab');
      expect(html).toContain('object-contain');
    });

    it('identifies extensionless student request image URLs and renders ImageWithLoading', () => {
      const html = renderToStaticMarkup(
        React.createElement(DocumentPreviewWithLoading, {
          src: '/api/student/requests/image/42',
          title: 'Payment Proof',
        })
      );
      expect(html).toContain('img');
      expect(html).toContain('Payment Proof');
      expect(html).toContain('object-contain');
    });
  });
});
