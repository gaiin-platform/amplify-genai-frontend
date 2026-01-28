/**
 * Tests for large text paste functionality
 * Focus: File type detection, CSV parsing, modal logic
 */

import {
  detectFileType,
  shouldShowModal,
  generateSessionKey,
  createFileFromText,
  FileTypeResult
} from '@/utils/app/largeText';

describe('detectFileType', () => {
  describe('JSON Detection', () => {
    it('should detect valid JSON object with high confidence', () => {
      const json = '{"name": "test", "value": 123}';
      const result = detectFileType(json);

      expect(result.extension).toBe('json');
      expect(result.mimeType).toBe('application/json');
      expect(result.confidence).toBe('high');
    });

    it('should detect valid JSON array with high confidence', () => {
      const json = '[{"id": 1}, {"id": 2}]';
      const result = detectFileType(json);

      expect(result.extension).toBe('json');
      expect(result.confidence).toBe('high');
    });

    it('should detect multiline formatted JSON', () => {
      const json = `{
  "name": "test",
  "nested": {
    "value": 123
  }
}`;
      const result = detectFileType(json);

      expect(result.extension).toBe('json');
      expect(result.confidence).toBe('high');
    });

    it('should reject invalid JSON', () => {
      const notJson = '{this is not valid json}';
      const result = detectFileType(notJson);

      expect(result.extension).not.toBe('json');
    });

    it('should reject text that just contains braces', () => {
      const text = 'This text has some {braces} but is not JSON';
      const result = detectFileType(text);

      expect(result.extension).toBe('txt');
    });
  });

  describe('CSV Detection', () => {
    it('should detect standard CSV with commas', () => {
      const csv = `Name,Email,Age
John Doe,john@test.com,30
Jane Smith,jane@test.com,25`;
      const result = detectFileType(csv);

      expect(result.extension).toBe('csv');
      expect(result.confidence).toBe('high');
    });

    it('should detect CSV with quoted fields containing commas', () => {
      const csv = `Name,Company,Email
"John Doe","ABC, Inc.","john@test.com"
"Jane Smith","XYZ, Corp","jane@test.com"`;
      const result = detectFileType(csv);

      expect(result.extension).toBe('csv');
      expect(result.confidence).toBe('high');
    });

    it('should handle CSV with mixed quoted and unquoted fields', () => {
      const csv = `Name,Description,Value
Product1,"This has, comma",100
Product2,Simple,200`;
      const result = detectFileType(csv);

      expect(result.extension).toBe('csv');
    });

    it('should detect tab-separated values as CSV', () => {
      const tsv = `Name\tEmail\tAge
John Doe\tjohn@test.com\t30
Jane Smith\tjane@test.com\t25`;
      const result = detectFileType(tsv);

      expect(result.extension).toBe('csv');
    });

    it('should reject inconsistent delimiter patterns', () => {
      const inconsistent = `Name,Email,Age
John Doe,john@test.com,30
Jane Smith;jane@test.com;25`;
      const result = detectFileType(inconsistent);

      // Should not be detected as CSV due to inconsistency
      expect(result.confidence).not.toBe('high');
    });

    it('should require at least 3 lines for CSV detection', () => {
      const tooShort = `Name,Email`;
      const result = detectFileType(tooShort);

      expect(result.extension).toBe('txt');
    });

    it('should handle CSV with empty fields', () => {
      const csv = `Name,Email,Phone
John,,555-1234
,jane@test.com,`;
      const result = detectFileType(csv);

      expect(result.extension).toBe('csv');
    });
  });

  describe('XML Detection', () => {
    it('should detect XML with declaration', () => {
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<root>
  <item>Test</item>
</root>`;
      const result = detectFileType(xml);

      expect(result.extension).toBe('xml');
      expect(result.confidence).toBe('high');
    });

    it('should detect XML without declaration', () => {
      const xml = `<root>
  <item id="1">Test</item>
  <item id="2">Another</item>
</root>`;
      const result = detectFileType(xml);

      expect(result.extension).toBe('xml');
    });

    it('should detect HTML as XML', () => {
      const html = `<!DOCTYPE html>
<html>
<head><title>Test</title></head>
<body><p>Content</p></body>
</html>`;
      const result = detectFileType(html);

      expect(result.extension).toBe('xml');
    });

    it('should reject text with angle brackets that is not XML', () => {
      const notXml = 'This text mentions <something> but is not XML';
      const result = detectFileType(notXml);

      expect(result.extension).toBe('txt');
    });
  });

  describe('Plain Text Fallback', () => {
    it('should default to txt for unstructured text', () => {
      const text = 'This is just plain text without any structure.';
      const result = detectFileType(text);

      expect(result.extension).toBe('txt');
      expect(result.mimeType).toBe('text/plain');
      expect(result.confidence).toBe('low');
    });

    it('should handle Lorem ipsum text', () => {
      const lorem = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(10);
      const result = detectFileType(lorem);

      expect(result.extension).toBe('txt');
      expect(result.confidence).toBe('low');
    });

    it('should handle empty string', () => {
      const result = detectFileType('');

      expect(result.extension).toBe('txt');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large text (100KB+)', () => {
      const largeText = 'Lorem ipsum dolor sit amet. '.repeat(4000); // ~112KB
      const result = detectFileType(largeText);

      expect(result).toBeDefined();
      expect(result.extension).toBeTruthy();
    });

    it('should handle text with only whitespace', () => {
      const whitespace = '   \n\n   \t\t   ';
      const result = detectFileType(whitespace);

      expect(result.extension).toBe('txt');
    });

    it('should handle single line text', () => {
      const oneLine = 'Just one line of text';
      const result = detectFileType(oneLine);

      expect(result.extension).toBe('txt');
    });
  });
});

describe('shouldShowModal', () => {
  const mockFileType: FileTypeResult = {
    extension: 'txt',
    mimeType: 'text/plain',
    confidence: 'low'
  };

  it('should show modal when text exceeds model limit', () => {
    const result = shouldShowModal(
      150000, // 150KB
      mockFileType,
      100000, // Model limit: 100KB
      500000  // Max chars: 500KB
    );

    expect(result).toBe(true);
  });

  it('should show modal for large text with low confidence', () => {
    const result = shouldShowModal(
      150000, // 150KB
      { ...mockFileType, confidence: 'low' },
      undefined, // No model limit
      100000  // Max chars: 100KB
    );

    expect(result).toBe(true);
  });

  it('should show modal when exceeding max chars with medium confidence', () => {
    const result = shouldShowModal(
      600000, // 600KB
      { ...mockFileType, confidence: 'medium' },
      undefined,
      500000  // Max chars: 500KB
    );

    expect(result).toBe(true);
  });

  it('should NOT show modal for text under max with high confidence', () => {
    const result = shouldShowModal(
      50000, // 50KB
      { ...mockFileType, confidence: 'high' },
      undefined,
      100000  // Max chars: 100KB
    );

    expect(result).toBe(false);
  });

  it('should NOT show modal when size is below max and confidence is high', () => {
    const jsonType: FileTypeResult = {
      extension: 'json',
      mimeType: 'application/json',
      confidence: 'high'
    };

    const result = shouldShowModal(
      80000,
      jsonType,
      undefined,
      100000
    );

    expect(result).toBe(false);
  });

  it('should handle undefined model limit gracefully', () => {
    const result = shouldShowModal(
      50000,
      mockFileType,
      undefined,
      100000
    );

    expect(result).toBe(false);
  });
});

describe('generateSessionKey', () => {
  it('should generate consistent keys for same size range and extension', () => {
    const key1 = generateSessionKey(105000, 'json');
    const key2 = generateSessionKey(110000, 'json');

    expect(key1).toBe(key2);
  });

  it('should generate different keys for different size ranges', () => {
    const key1 = generateSessionKey(95000, 'json');  // 0-100K range
    const key2 = generateSessionKey(105000, 'json'); // 100-200K range

    expect(key1).not.toBe(key2);
  });

  it('should generate different keys for different extensions', () => {
    const key1 = generateSessionKey(50000, 'json');
    const key2 = generateSessionKey(50000, 'csv');

    expect(key1).not.toBe(key2);
  });

  it('should round to 100KB buckets', () => {
    const key = generateSessionKey(150000, 'txt');

    expect(key).toBe('txt-100000');
  });

  it('should handle zero size', () => {
    const key = generateSessionKey(0, 'txt');

    expect(key).toBe('txt-0');
  });
});

describe('createFileFromText', () => {
  it('should create a File object with correct properties', () => {
    const text = 'Test content';
    const fileType: FileTypeResult = {
      extension: 'json',
      mimeType: 'application/json',
      confidence: 'high'
    };

    const file = createFileFromText(text, fileType);

    expect(file).toBeInstanceOf(File);
    expect(file.type).toBe('application/json');
    expect(file.name).toMatch(/pasted-text.*\.json/);
  });

  it('should create file with txt extension', () => {
    const text = 'Plain text';
    const fileType: FileTypeResult = {
      extension: 'txt',
      mimeType: 'text/plain',
      confidence: 'low'
    };

    const file = createFileFromText(text, fileType);

    expect(file.name).toMatch(/pasted-text.*\.txt/);
  });

  it('should handle large text', () => {
    const largeText = 'Lorem ipsum. '.repeat(10000); // ~130KB
    const fileType: FileTypeResult = {
      extension: 'txt',
      mimeType: 'text/plain',
      confidence: 'low'
    };

    const file = createFileFromText(largeText, fileType);

    expect(file.size).toBeGreaterThan(100000);
  });

  it('should create unique filenames', async () => {
    const fileType: FileTypeResult = {
      extension: 'txt',
      mimeType: 'text/plain',
      confidence: 'low'
    };

    const file1 = createFileFromText('test1', fileType);

    // Wait 1ms to ensure different timestamp
    await new Promise(resolve => setTimeout(resolve, 1));

    const file2 = createFileFromText('test2', fileType);

    expect(file1.name).not.toBe(file2.name);
  });
});

describe('CSV Field Counting (Edge Cases)', () => {
  // Note: This tests the internal countCSVFields function indirectly through detectFileType

  it('should handle CSV with nested quotes', () => {
    const csv = `Name,Quote
John,"He said ""hello"" to me"
Jane,"She said ""goodbye"""`;
    const result = detectFileType(csv);

    expect(result.extension).toBe('csv');
  });

  it('should handle CSV with quotes at field boundaries', () => {
    const csv = `Name,Value
"Field1",100
"Field2",200`;
    const result = detectFileType(csv);

    expect(result.extension).toBe('csv');
  });

  it('should handle CSV with trailing comma', () => {
    const csv = `Name,Email,
John,john@test.com,
Jane,jane@test.com,`;
    const result = detectFileType(csv);

    expect(result.extension).toBe('csv');
  });
});
