/**
 * Gallery Sort Algorithm Test
 *
 * Purpose: Test sorting logic independently without server/database
 * This helps verify if the sorting algorithm works correctly
 */

// Sample data matching database structure
const mockImages = [
  {
    id: '2cec89f7-abcd-1234-5678-000000000001',
    approved_at: '2025-12-28T14:03:03.510Z',
    like_count: 1,
    comment_count: 0
  },
  {
    id: '245245b9-abcd-1234-5678-000000000002',
    approved_at: '2025-12-27T21:21:07.089Z',
    like_count: 2,
    comment_count: 0
  },
  {
    id: 'c137264e-abcd-1234-5678-000000000003',
    approved_at: '2025-12-27T20:59:31.504Z',
    like_count: 1,
    comment_count: 0
  },
  {
    id: '7bc20f67-abcd-1234-5678-000000000004',
    approved_at: '2025-12-27T20:58:45.617Z',
    like_count: 2,
    comment_count: 2
  },
  {
    id: 'feb49a01-abcd-1234-5678-000000000005',
    approved_at: '2025-12-27T20:58:43.064Z',
    like_count: 1,
    comment_count: 0
  }
];

// Copy of the actual sorting logic from imageController.js
function sortImages(images, sortBy) {
  const sorted = [...images]; // Clone to avoid mutating original

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

// Test functions
function testLatestSort() {
  console.log('\n📊 Testing: LATEST sort');
  const sorted = sortImages(mockImages, 'latest');

  console.log('Expected order (newest first):');
  console.log('  1. 2cec89f7 (2025-12-28)');
  console.log('  2. 245245b9 (2025-12-27 21:21)');
  console.log('  3. c137264e (2025-12-27 20:59)');

  console.log('\nActual order:');
  sorted.forEach((img, i) => {
    console.log(`  ${i + 1}. ${img.id.substring(0, 8)} (${img.approved_at})`);
  });

  // Verify
  const pass = sorted[0].id.startsWith('2cec89f7') &&
               sorted[1].id.startsWith('245245b9');
  console.log(pass ? '✅ PASS' : '❌ FAIL');
  return pass;
}

function testOldestSort() {
  console.log('\n📊 Testing: OLDEST sort');
  const sorted = sortImages(mockImages, 'oldest');

  console.log('Expected order (oldest first):');
  console.log('  1. feb49a01 (2025-12-27 20:58:43)');
  console.log('  2. 7bc20f67 (2025-12-27 20:58:45)');
  console.log('  3. c137264e (2025-12-27 20:59:31)');

  console.log('\nActual order:');
  sorted.forEach((img, i) => {
    console.log(`  ${i + 1}. ${img.id.substring(0, 8)} (${img.approved_at})`);
  });

  // Verify
  const pass = sorted[0].id.startsWith('feb49a01') &&
               sorted[1].id.startsWith('7bc20f67');
  console.log(pass ? '✅ PASS' : '❌ FAIL');
  return pass;
}

function testMostLikedSort() {
  console.log('\n📊 Testing: MOST LIKED sort');
  const sorted = sortImages(mockImages, 'most_liked');

  console.log('Expected order (most likes first):');
  console.log('  1. 245245b9 (2 likes)');
  console.log('  2. 7bc20f67 (2 likes)');
  console.log('  3. 2cec89f7 (1 like)');

  console.log('\nActual order:');
  sorted.forEach((img, i) => {
    console.log(`  ${i + 1}. ${img.id.substring(0, 8)} (${img.like_count} likes)`);
  });

  // Verify
  const pass = sorted[0].like_count === 2 &&
               sorted[1].like_count === 2 &&
               sorted[2].like_count === 1;
  console.log(pass ? '✅ PASS' : '❌ FAIL');
  return pass;
}

function testMostCommentedSort() {
  console.log('\n📊 Testing: MOST COMMENTED sort');
  const sorted = sortImages(mockImages, 'most_commented');

  console.log('Expected order (most comments first):');
  console.log('  1. 7bc20f67 (2 comments)');
  console.log('  2. Others (0 comments)');

  console.log('\nActual order:');
  sorted.forEach((img, i) => {
    console.log(`  ${i + 1}. ${img.id.substring(0, 8)} (${img.comment_count} comments)`);
  });

  // Verify
  const pass = sorted[0].id.startsWith('7bc20f67') &&
               sorted[0].comment_count === 2;
  console.log(pass ? '✅ PASS' : '❌ FAIL');
  return pass;
}

// Run all tests
console.log('═══════════════════════════════════════════════════');
console.log('🧪 Gallery Sort Algorithm Tests');
console.log('═══════════════════════════════════════════════════');

const results = {
  latest: testLatestSort(),
  oldest: testOldestSort(),
  most_liked: testMostLikedSort(),
  most_commented: testMostCommentedSort()
};

console.log('\n═══════════════════════════════════════════════════');
console.log('📋 Test Summary:');
console.log(`  Latest:        ${results.latest ? '✅' : '❌'}`);
console.log(`  Oldest:        ${results.oldest ? '✅' : '❌'}`);
console.log(`  Most Liked:    ${results.most_liked ? '✅' : '❌'}`);
console.log(`  Most Commented: ${results.most_commented ? '✅' : '❌'}`);
console.log('═══════════════════════════════════════════════════');

const allPass = Object.values(results).every(r => r);
console.log(allPass ? '\n🎉 All tests PASSED!' : '\n❌ Some tests FAILED!');
console.log('═══════════════════════════════════════════════════\n');

process.exit(allPass ? 0 : 1);
