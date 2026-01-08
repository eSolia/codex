-- Migration: Add cover letter boilerplate fragments
-- These appear in the CoverLetterEditor dropdown for quick insertion

INSERT INTO fragments (id, name, slug, category, content_en, content_ja, created_at, updated_at)
VALUES
  (
    'cover-letter-intro-general',
    'General Introduction',
    'cover-letter-intro-general',
    'cover-letter',
    '<p>Thank you for the opportunity to discuss your IT requirements. We are pleased to present this proposal outlining how eSolia can support your organization.</p>',
    '<p>この度は、貴社のIT要件についてご相談いただき、誠にありがとうございます。イソリアがどのように貴社をサポートできるか、本提案書にてご説明させていただきます。</p>',
    datetime('now'),
    datetime('now')
  ),
  (
    'cover-letter-intro-followup',
    'Follow-up Meeting Introduction',
    'cover-letter-intro-followup',
    'cover-letter',
    '<p>Following our recent meeting, we have prepared this proposal based on the requirements discussed. We believe our approach will effectively address your needs while providing excellent value.</p>',
    '<p>先日の打ち合わせを踏まえ、ご要望に基づいた本提案書を作成いたしました。弊社のアプローチが貴社のニーズに効果的に対応し、優れた価値を提供できると確信しております。</p>',
    datetime('now'),
    datetime('now')
  ),
  (
    'cover-letter-closing-standard',
    'Standard Closing',
    'cover-letter-closing-standard',
    'cover-letter',
    '<p>We look forward to the opportunity to work with you and are available to discuss any questions you may have about this proposal. Please do not hesitate to contact us.</p>',
    '<p>貴社とお取引させていただく機会を楽しみにしております。本提案書についてご質問がございましたら、お気軽にお問い合わせください。</p>',
    datetime('now'),
    datetime('now')
  ),
  (
    'cover-letter-virtual-it',
    'Virtual IT Department Pitch',
    'cover-letter-virtual-it',
    'cover-letter',
    '<p>As your "Virtual IT Department," eSolia provides comprehensive IT management without the overhead of maintaining a full internal team. Our bilingual professionals integrate seamlessly with your operations, offering the expertise and responsiveness you need.</p>',
    '<p>「バーチャルIT部門」として、イソリアは社内チームを維持するオーバーヘッドなしに、包括的なIT管理を提供いたします。バイリンガルのプロフェッショナルが貴社の業務にシームレスに統合し、必要な専門知識と対応力をお届けします。</p>',
    datetime('now'),
    datetime('now')
  ),
  (
    'cover-letter-security-focus',
    'Security-Focused Introduction',
    'cover-letter-security-focus',
    'cover-letter',
    '<p>In today''s threat landscape, robust IT security is essential. This proposal outlines how eSolia can help strengthen your security posture while maintaining operational efficiency. Our approach balances protection with productivity.</p>',
    '<p>今日の脅威環境において、堅牢なITセキュリティは不可欠です。本提案書では、業務効率を維持しながらセキュリティ態勢を強化するためのイソリアのサポート内容をご説明いたします。弊社のアプローチは、保護と生産性のバランスを重視しています。</p>',
    datetime('now'),
    datetime('now')
  );

-- InfoSec: Boilerplate content is pre-approved, static text (no user input sanitization needed)
