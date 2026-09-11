/* ───────────────────────────────────────────── */

/**
 * components/ozi-editor/lang/en.js
 */
(function (window) {
    'use strict';
    var lang = window.OZI && window.OZI.lang;
    if (!lang || !lang.register) return;
    lang.register('en', {
        editor: {
            bold:        'Bold',
            italic:      'Italic',
            underline:   'Underline',
            strike:      'Strikethrough',
            ul:          'Bullet list',
            ol:          'Numbered list',
            codeblock:   'Code block',
            source:      'HTML',
            table:       'Table',
            heading:     'Heading',
            h1:          'Heading 1',
            h2:          'Heading 2',
            h3:          'Heading 3',
            h4:          'Heading 4',
            h5:          'Heading 5',
            h6:          'Heading 6',
            classes:     'Styles',
            alignLeft:   'Align left',
            alignCenter: 'Center',
            alignRight:  'Align right',
            justify:     'Justify',
            quote:       'Quote',
            hr:          'Horizontal line',
            undo:        'Undo',
            redo:        'Redo',
            link:        'Link',
            unlink:      'Remove link',
            linkUrl:     'URL',
            color:       'Text color',
            highlight:   'Highlight color',
            image:            'Image',
            imageUrl:         'URL',
            imageAlt:         'Alt text',
            imageWidth:       'Width',
            imageHeight:      'Height',
            imageUpload:      'Upload',
            imageUploading:   'Uploading…',
            imageUploadFailed: 'Could not upload the image. Please try again.',
            imageInvalidUrl:  'Invalid URL or scheme not allowed.',
            imageAlign:       'Alignment',
            imageAlignLeft:   'Left (text wraps)',
            imageAlignRight:  'Right (text wraps)',
            imageAlignCenter: 'Centered',
            imageAlignFree:   'Free position (drag the image)',
            paste:       'Paste',
            pasteFmt:    'Paste with formatting',
            apply:       'Apply',
            remove:      'Remove',
            none:        'None',
            customize:   'Customize',
            clipboardBlocked: 'Could not read the clipboard. Check the browser permission (address bar / site settings).',
            words:       'words',
            chars:       'characters',
            clear:       'Clear format',
            moreTools:   'More tools',
            fewerTools:  'Fewer tools',
            scrollPrev:  'Scroll back',
            scrollNext:  'Scroll forward',
            unknown:     'Unknown tool',
            incompatible: 'Not available in this mode',
            placeholder: 'Type here...'
        }
    });
})(window);
