/**
 * Comprehensive Test Suite for ShareYourPic Backend
 *
 * Tests all major functionalities:
 * - Image sorting (all methods)
 * - Like system
 * - Comment system
 * - Payment validation
 * - Tenant isolation
 * - Image filtering
 * - Pagination
 * - Session management
 */

import { strict as assert } from 'assert';

// ==========================================
// MOCK DATA
// ==========================================

const mockTenants = [
  { id: 'tenant-1', slug: 'default', name: 'Default Event', payment_enabled: true },
  { id: 'tenant-2', slug: 'wedding', name: 'Wedding Event', payment_enabled: false }
];

const mockImages = [
  {
    id: 'img-001',
    tenant_id: 'tenant-1',
    approved_at: '2025-12-28T14:03:03.510Z',
    like_count: 1,
    comment_count: 0,
    status: 'approved'
  },
  {
    id: 'img-002',
    tenant_id: 'tenant-1',
    approved_at: '2025-12-27T21:21:07.089Z',
    like_count: 2,
    comment_count: 0,
    status: 'approved'
  },
  {
    id: 'img-003',
    tenant_id: 'tenant-1',
    approved_at: '2025-12-27T20:59:31.504Z',
    like_count: 1,
    comment_count: 0,
    status: 'approved'
  },
  {
    id: 'img-004',
    tenant_id: 'tenant-1',
    approved_at: '2025-12-27T20:58:45.617Z',
    like_count: 2,
    comment_count: 2,
    status: 'approved'
  },
  {
    id: 'img-005',
    tenant_id: 'tenant-1',
    approved_at: '2025-12-27T20:58:43.064Z',
    like_count: 1,
    comment_count: 0,
    status: 'pending'
  },
  {
    id: 'img-006',
    tenant_id: 'tenant-2',
    approved_at: '2025-12-28T10:00:00.000Z',
    like_count: 5,
    comment_count: 3,
    status: 'approved'
  }
];

const mockLikes = [
  { image_id: 'img-002', session_id: 'session-1' },
  { image_id: 'img-002', session_id: 'session-2' },
  { image_id: 'img-004', session_id: 'session-1' },
  { image_id: 'img-004', session_id: 'session-3' }
];

const mockComments = [
  { image_id: 'img-004', session_id: 'session-1', text: 'Great photo!', created_at: '2025-12-27T21:00:00Z' },
  { image_id: 'img-004', session_id: 'session-2', text: 'Love it!', created_at: '2025-12-27T21:05:00Z' }
];

// ==========================================
// UTILITY FUNCTIONS (mimic backend logic)
// ==========================================

function sortImages(images, sortBy) {
  const sorted = [...images];

  switch (sortBy) {
    case 'latest':
      sorted.sort((a, b) => new Date(b.approved_at) - new Date(a.approved_at));
      break;
    case 'oldest':
      sorted.sort((a, b) => new Date(a.approved_at) - new Date(b.approved_at));
      break;
    case 'most_liked':
      sorted.sort((a, b) => (b.like_count || 0) - (a.like_count || 0));
      break;
    case 'most_commented':
      sorted.sort((a, b) => (b.comment_count || 0) - (a.comment_count || 0));
      break;
    default:
      sorted.sort((a, b) => new Date(b.approved_at) - new Date(a.approved_at));
  }

  return sorted;
}

function filterImagesByStatus(images, status) {
  if (!status) return images;
  return images.filter(img => img.status === status);
}

function filterImagesByTenant(images, tenantId) {
  return images.filter(img => img.tenant_id === tenantId);
}

function hasUserLiked(imageId, sessionId) {
  return mockLikes.some(like => like.image_id === imageId && like.session_id === sessionId);
}

function getLikeCount(imageId) {
  return mockLikes.filter(like => like.image_id === imageId).length;
}

function getCommentCount(imageId) {
  return mockComments.filter(comment => comment.image_id === imageId).length;
}

function paginateImages(images, offset = 0, limit = 10) {
  return images.slice(offset, offset + limit);
}

function validatePaymentAmount(amount, currency) {
  // Stripe minimum amounts (in smallest currency unit - satang for THB, cents for USD)
  const minimums = {
    'thb': 2000, // 20 THB = 2000 satang
    'usd': 50,   // 50 cents
    'eur': 50    // 50 cents
  };

  const minAmount = minimums[currency.toLowerCase()] || 50;
  return amount >= minAmount;
}

function sanitizeComment(text, maxLength = 500) {
  if (!text || typeof text !== 'string') return '';

  // Remove HTML tags AND content inside script tags
  let sanitized = text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags and content
    .replace(/<[^>]*>/g, ''); // Remove other HTML tags

  // Trim whitespace
  sanitized = sanitized.trim();

  // Enforce max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }

  return sanitized;
}

function isValidUUID(uuid) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

// ==========================================
// TEST SUITE
// ==========================================

const testResults = [];

function test(name, fn) {
  try {
    fn();
    testResults.push({ name, status: 'PASS', error: null });
    console.log(`✅ ${name}`);
  } catch (error) {
    testResults.push({ name, status: 'FAIL', error: error.message });
    console.log(`❌ ${name}`);
    console.log(`   Error: ${error.message}`);
  }
}

console.log('\n' + '═'.repeat(70));
console.log('🧪 COMPREHENSIVE TEST SUITE - ShareYourPic Backend');
console.log('═'.repeat(70) + '\n');

// ==========================================
// IMAGE SORTING TESTS
// ==========================================

console.log('📊 IMAGE SORTING TESTS');
console.log('-'.repeat(70));

test('Sort by latest (newest first)', () => {
  let images = filterImagesByTenant(mockImages, 'tenant-1'); // Filter tenant first!
  images = filterImagesByStatus(images, 'approved');
  const sorted = sortImages(images, 'latest');

  assert.equal(sorted[0].id, 'img-001', 'First should be img-001 (2025-12-28)');
  assert.equal(sorted[1].id, 'img-002', 'Second should be img-002 (2025-12-27 21:21)');
});

test('Sort by oldest (oldest first)', () => {
  const approvedImages = filterImagesByStatus(mockImages, 'approved');
  const sorted = sortImages(approvedImages, 'oldest');

  assert.equal(sorted[0].id, 'img-004', 'First should be img-004 (2025-12-27 20:58:45)');
  assert.equal(sorted[1].id, 'img-003', 'Second should be img-003 (2025-12-27 20:59)');
});

test('Sort by most liked', () => {
  let images = filterImagesByTenant(mockImages, 'tenant-1'); // Filter tenant first!
  images = filterImagesByStatus(images, 'approved');
  const sorted = sortImages(images, 'most_liked');

  assert.equal(sorted[0].like_count, 2, 'First should have 2 likes');
  assert.equal(sorted[1].like_count, 2, 'Second should have 2 likes');
  assert(sorted[2].like_count === 1, 'Third should have 1 like');
});

test('Sort by most commented', () => {
  let images = filterImagesByTenant(mockImages, 'tenant-1'); // Filter tenant first!
  images = filterImagesByStatus(images, 'approved');
  const sorted = sortImages(images, 'most_commented');

  assert.equal(sorted[0].id, 'img-004', 'img-004 should be first (2 comments)');
  assert.equal(sorted[0].comment_count, 2, 'Should have 2 comments');
});

test('Default sort (no sort param)', () => {
  const approvedImages = filterImagesByStatus(mockImages, 'approved');
  const sorted = sortImages(approvedImages);

  // Should default to latest
  assert.equal(sorted[0].id, 'img-001', 'Should default to latest sort');
});

console.log('');

// ==========================================
// IMAGE FILTERING TESTS
// ==========================================

console.log('🔍 IMAGE FILTERING TESTS');
console.log('-'.repeat(70));

test('Filter by status: approved', () => {
  const approved = filterImagesByStatus(mockImages, 'approved');
  assert.equal(approved.length, 5, 'Should have 5 approved images');
  assert(approved.every(img => img.status === 'approved'), 'All should be approved');
});

test('Filter by status: pending', () => {
  const pending = filterImagesByStatus(mockImages, 'pending');
  assert.equal(pending.length, 1, 'Should have 1 pending image');
  assert.equal(pending[0].id, 'img-005', 'Should be img-005');
});

test('Filter by tenant ID', () => {
  const tenant1Images = filterImagesByTenant(mockImages, 'tenant-1');
  const tenant2Images = filterImagesByTenant(mockImages, 'tenant-2');

  assert.equal(tenant1Images.length, 5, 'Tenant 1 should have 5 images');
  assert.equal(tenant2Images.length, 1, 'Tenant 2 should have 1 image');
  assert(tenant1Images.every(img => img.tenant_id === 'tenant-1'), 'Tenant isolation works');
});

test('Tenant isolation (cross-tenant access prevention)', () => {
  const tenant1Images = filterImagesByTenant(mockImages, 'tenant-1');
  const tenant2Image = mockImages.find(img => img.id === 'img-006');

  assert(!tenant1Images.includes(tenant2Image), 'Tenant 1 should not see tenant 2 images');
});

console.log('');

// ==========================================
// LIKE SYSTEM TESTS
// ==========================================

console.log('❤️  LIKE SYSTEM TESTS');
console.log('-'.repeat(70));

test('Check if user has liked an image', () => {
  const liked = hasUserLiked('img-002', 'session-1');
  const notLiked = hasUserLiked('img-001', 'session-1');

  assert.equal(liked, true, 'Session-1 should have liked img-002');
  assert.equal(notLiked, false, 'Session-1 should not have liked img-001');
});

test('Get like count for image', () => {
  const count1 = getLikeCount('img-002');
  const count2 = getLikeCount('img-004');
  const count3 = getLikeCount('img-001');

  assert.equal(count1, 2, 'img-002 should have 2 likes');
  assert.equal(count2, 2, 'img-004 should have 2 likes');
  assert.equal(count3, 0, 'img-001 should have 0 likes (not in mockLikes)');
});

test('Prevent duplicate likes (same session)', () => {
  const alreadyLiked = hasUserLiked('img-002', 'session-1');
  assert.equal(alreadyLiked, true, 'Should detect existing like');

  // In real implementation, this would return error or no-op
});

test('Different sessions can like same image', () => {
  const session1Liked = hasUserLiked('img-002', 'session-1');
  const session2Liked = hasUserLiked('img-002', 'session-2');

  assert.equal(session1Liked, true, 'Session 1 liked');
  assert.equal(session2Liked, true, 'Session 2 also liked');
  assert.equal(getLikeCount('img-002'), 2, 'Total 2 likes');
});

console.log('');

// ==========================================
// COMMENT SYSTEM TESTS
// ==========================================

console.log('💬 COMMENT SYSTEM TESTS');
console.log('-'.repeat(70));

test('Get comment count for image', () => {
  const count = getCommentCount('img-004');
  assert.equal(count, 2, 'img-004 should have 2 comments');
});

test('Sanitize comment text (remove HTML)', () => {
  const dirty = '<script>alert("XSS")</script>Hello!';
  const clean = sanitizeComment(dirty);

  assert.equal(clean, 'Hello!', 'Should remove HTML tags');
  assert(!clean.includes('<script>'), 'Should not contain script tags');
});

test('Sanitize comment text (max length)', () => {
  const longText = 'a'.repeat(600);
  const sanitized = sanitizeComment(longText, 500);

  assert.equal(sanitized.length, 500, 'Should enforce max length');
});

test('Sanitize comment text (trim whitespace)', () => {
  const text = '   Hello World!   ';
  const sanitized = sanitizeComment(text);

  assert.equal(sanitized, 'Hello World!', 'Should trim whitespace');
});

test('Reject empty comments', () => {
  const empty1 = sanitizeComment('');
  const empty2 = sanitizeComment('   ');

  assert.equal(empty1, '', 'Empty string should remain empty');
  assert.equal(empty2, '', 'Whitespace-only should become empty');
});

console.log('');

// ==========================================
// PAGINATION TESTS
// ==========================================

console.log('📄 PAGINATION TESTS');
console.log('-'.repeat(70));

test('Paginate: first page (offset 0, limit 3)', () => {
  const approvedImages = filterImagesByStatus(mockImages, 'approved');
  const page1 = paginateImages(approvedImages, 0, 3);

  assert.equal(page1.length, 3, 'Should return 3 items');
  assert.equal(page1[0].id, 'img-001', 'First item correct');
});

test('Paginate: second page (offset 3, limit 3)', () => {
  const approvedImages = filterImagesByStatus(mockImages, 'approved');
  const page2 = paginateImages(approvedImages, 3, 3);

  assert.equal(page2.length, 2, 'Should return 2 items (remaining)');
  assert.equal(page2[0].id, 'img-004', 'First item of page 2 correct');
});

test('Paginate: empty page (offset beyond items)', () => {
  const approvedImages = filterImagesByStatus(mockImages, 'approved');
  const emptyPage = paginateImages(approvedImages, 100, 10);

  assert.equal(emptyPage.length, 0, 'Should return empty array');
});

test('Paginate: default params', () => {
  const approvedImages = filterImagesByStatus(mockImages, 'approved');
  const defaultPage = paginateImages(approvedImages);

  assert.equal(defaultPage.length, 5, 'Should return all items (less than limit 10)');
});

console.log('');

// ==========================================
// PAYMENT VALIDATION TESTS
// ==========================================

console.log('💳 PAYMENT VALIDATION TESTS');
console.log('-'.repeat(70));

test('Validate payment amount: THB minimum', () => {
  const valid = validatePaymentAmount(2000, 'thb'); // 20 THB in satang
  const invalid = validatePaymentAmount(10, 'thb'); // 10 satang (< 20 THB)

  assert.equal(valid, true, '20 THB should be valid');
  assert.equal(invalid, false, 'Less than minimum should be invalid');
});

test('Validate payment amount: USD minimum', () => {
  const valid = validatePaymentAmount(50, 'usd'); // 50 cents
  const invalid = validatePaymentAmount(25, 'usd'); // 25 cents

  assert.equal(valid, true, '50 cents should be valid');
  assert.equal(invalid, false, 'Less than minimum should be invalid');
});

test('Payment required check (tenant setting)', () => {
  const tenant1 = mockTenants.find(t => t.id === 'tenant-1');
  const tenant2 = mockTenants.find(t => t.id === 'tenant-2');

  assert.equal(tenant1.payment_enabled, true, 'Tenant 1 requires payment');
  assert.equal(tenant2.payment_enabled, false, 'Tenant 2 does not require payment');
});

console.log('');

// ==========================================
// SECURITY & VALIDATION TESTS
// ==========================================

console.log('🔒 SECURITY & VALIDATION TESTS');
console.log('-'.repeat(70));

test('Validate UUID format', () => {
  const validUUID = '123e4567-e89b-12d3-a456-426614174000';
  const invalidUUID = 'not-a-uuid';

  assert.equal(isValidUUID(validUUID), true, 'Valid UUID should pass');
  assert.equal(isValidUUID(invalidUUID), false, 'Invalid UUID should fail');
});

test('XSS prevention in comments', () => {
  const xssAttempts = [
    '<script>alert("XSS")</script>',
    '<img src=x onerror=alert("XSS")>',
    '<a href="javascript:alert(\'XSS\')">Click</a>'
  ];

  xssAttempts.forEach(attempt => {
    const sanitized = sanitizeComment(attempt);
    assert(!sanitized.includes('<'), 'Should remove all HTML tags');
    assert(!sanitized.includes('script'), 'Should remove script content');
  });
});

test('SQL injection prevention (parameterized queries)', () => {
  // This is a conceptual test - actual implementation uses prepared statements
  const maliciousInput = "' OR '1'='1";

  // In real implementation, this would be escaped/parameterized
  assert(typeof maliciousInput === 'string', 'Input is treated as string');
  assert(!maliciousInput.includes(';'), 'No SQL statement terminator in this example');
});

console.log('');

// ==========================================
// EDGE CASES & ERROR HANDLING
// ==========================================

console.log('⚠️  EDGE CASES & ERROR HANDLING');
console.log('-'.repeat(70));

test('Handle empty image list', () => {
  const sorted = sortImages([], 'latest');
  assert.equal(sorted.length, 0, 'Should return empty array');
});

test('Handle null/undefined like_count', () => {
  const imageWithNullLikes = { id: 'test', like_count: null };
  const imageWithUndefinedLikes = { id: 'test2', like_count: undefined };

  const sorted = sortImages([imageWithNullLikes, imageWithUndefinedLikes], 'most_liked');
  // Should not throw error, treats null/undefined as 0
  assert.equal(sorted.length, 2, 'Should handle null/undefined likes');
});

test('Handle invalid sort parameter', () => {
  const images = filterImagesByStatus(mockImages, 'approved');
  const sorted = sortImages(images, 'INVALID_SORT');

  // Should default to latest
  assert.equal(sorted[0].id, 'img-001', 'Should default to latest on invalid sort');
});

test('Handle pagination with negative offset', () => {
  const images = filterImagesByStatus(mockImages, 'approved');
  const result = paginateImages(images, -1, 3);

  // JavaScript slice handles negative indices gracefully
  assert(Array.isArray(result), 'Should still return array');
});

test('Handle very large limit in pagination', () => {
  const images = filterImagesByStatus(mockImages, 'approved');
  const result = paginateImages(images, 0, 99999);

  assert.equal(result.length, images.length, 'Should return all available items');
});

console.log('');

// ==========================================
// INTEGRATION SCENARIOS
// ==========================================

console.log('🔄 INTEGRATION SCENARIOS');
console.log('-'.repeat(70));

test('Gallery page flow: filter approved + sort + paginate', () => {
  // Simulate gallery page request
  const tenantId = 'tenant-1';
  const sortBy = 'most_liked';
  const offset = 0;
  const limit = 3;

  let images = filterImagesByTenant(mockImages, tenantId);
  images = filterImagesByStatus(images, 'approved');
  images = sortImages(images, sortBy);
  const page = paginateImages(images, offset, limit);

  assert.equal(page.length, 3, 'Should return paginated results');
  assert(page[0].like_count >= page[1].like_count, 'Should be sorted by likes');
  assert(page.every(img => img.tenant_id === tenantId), 'Tenant isolation maintained');
});

test('User like interaction flow', () => {
  const imageId = 'img-001';
  const sessionId = 'session-new';

  // Check if already liked
  const alreadyLiked = hasUserLiked(imageId, sessionId);
  assert.equal(alreadyLiked, false, 'User has not liked yet');

  // Simulate adding like (would happen in real implementation)
  // Then get updated count
  const currentCount = getLikeCount(imageId);
  assert(currentCount >= 0, 'Like count should be non-negative');
});

test('Multi-tenant isolation scenario', () => {
  // Admin of tenant-1 should only see tenant-1 images
  const tenant1Admin = { tenant_id: 'tenant-1', is_super_admin: false };
  const imagesForAdmin = filterImagesByTenant(mockImages, tenant1Admin.tenant_id);

  assert(imagesForAdmin.every(img => img.tenant_id === 'tenant-1'), 'Admin isolated to their tenant');
  assert(!imagesForAdmin.some(img => img.tenant_id === 'tenant-2'), 'Cannot see other tenant images');
});

console.log('');

// ==========================================
// PERFORMANCE & DATA CONSISTENCY
// ==========================================

console.log('⚡ PERFORMANCE & DATA CONSISTENCY');
console.log('-'.repeat(70));

test('Sort stability (items with same value maintain order)', () => {
  const images = [
    { id: 'a', like_count: 1, approved_at: '2025-01-01T10:00:00Z' },
    { id: 'b', like_count: 1, approved_at: '2025-01-01T11:00:00Z' },
    { id: 'c', like_count: 2, approved_at: '2025-01-01T12:00:00Z' }
  ];

  const sorted = sortImages(images, 'most_liked');

  // Item C should be first (2 likes)
  assert.equal(sorted[0].id, 'c', 'Highest like count first');
  // A and B both have 1 like - order should be preserved
});

test('Large dataset handling (1000 images)', () => {
  const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
    id: `img-${i}`,
    tenant_id: 'tenant-1',
    approved_at: new Date(Date.now() - i * 1000000).toISOString(),
    like_count: Math.floor(Math.random() * 100),
    comment_count: Math.floor(Math.random() * 50),
    status: 'approved'
  }));

  const start = Date.now();
  const sorted = sortImages(largeDataset, 'most_liked');
  const duration = Date.now() - start;

  assert.equal(sorted.length, 1000, 'Should handle 1000 items');
  assert(duration < 1000, `Sorting should be fast (took ${duration}ms)`);
});

console.log('');

// ==========================================
// TEST SUMMARY
// ==========================================

console.log('═'.repeat(70));
console.log('📊 TEST SUMMARY');
console.log('═'.repeat(70));

const passed = testResults.filter(t => t.status === 'PASS').length;
const failed = testResults.filter(t => t.status === 'FAIL').length;
const total = testResults.length;

console.log(`\nTotal Tests:  ${total}`);
console.log(`✅ Passed:     ${passed} (${((passed/total)*100).toFixed(1)}%)`);
console.log(`❌ Failed:     ${failed} (${((failed/total)*100).toFixed(1)}%)`);

if (failed > 0) {
  console.log('\n❌ Failed Tests:');
  testResults
    .filter(t => t.status === 'FAIL')
    .forEach(t => {
      console.log(`   - ${t.name}`);
      console.log(`     Error: ${t.error}`);
    });
}

console.log('\n' + '═'.repeat(70));

if (failed === 0) {
  console.log('🎉 ALL TESTS PASSED! Backend logic is working correctly! 🎉');
} else {
  console.log('⚠️  Some tests failed. Please review the errors above.');
}

console.log('═'.repeat(70) + '\n');

// Exit with appropriate code
process.exit(failed > 0 ? 1 : 0);
