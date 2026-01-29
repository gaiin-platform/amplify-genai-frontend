# Large Text Paste Preference System - How It Works

## Session Key System

Preferences are stored using a **session key** that combines two factors:

```
key = `${extension}-${sizeRange}`
```

### Extension
The detected file type:
- `json` - JSON data
- `csv` - CSV data
- `xml` - XML data
- `txt` - Plain text (default/fallback)

### Size Range
Text size rounded to 100KB buckets:
- `0` = 0-100 KB
- `100000` = 100-200 KB
- `200000` = 200-300 KB
- etc.

## Examples

| Text Type | Size | Session Key | Stored Separately? |
|-----------|------|-------------|-------------------|
| Plain text | 50 KB | `txt-0` | ✓ |
| Plain text | 120 KB | `txt-100000` | ✓ (different from above) |
| JSON | 120 KB | `json-100000` | ✓ (different extension) |
| CSV | 120 KB | `csv-100000` | ✓ (different extension) |
| JSON | 150 KB | `json-100000` | ✗ (same bucket as 120KB JSON) |

## When Does the Modal Show?

The modal appears when:

1. **Very large text (>100KB)** - Regardless of file type, to let you set a preference
2. **Exceeds model limit** - Text too large for the selected AI model
3. **Ambiguous format + medium size** - Low confidence detection and >50KB
4. **Large + not confident** - Size >100KB and we're not sure of the format

**Once you set a preference**, the modal won't show again for that session key!

## Settings Page Display

The Settings page shows all your preferences in a readable format:

```
TXT • 100+ KB → File attachment
JSON • 100+ KB → Text block
CSV • 0-100 KB → Plain text
```

This shows:
- **TXT** = File extension
- **100+ KB** = Size range (100KB and above)
- **→** = Maps to
- **File attachment** = Your chosen action

## Why Separate Preferences?

Different file types and sizes have different use cases:

- **Small JSON (50KB)** → Might want as text block (easy to edit)
- **Large JSON (150KB)** → Might want as file (keeps prompt clean)
- **Small CSV** → Might want as plain text (quick paste)
- **Large CSV** → Might want as file (better for data analysis)

The system learns your preference for each combination!

## Clearing Preferences

Click "Clear All" in Settings → Features to reset all preferences. The next time you paste large text, the modal will appear again.
