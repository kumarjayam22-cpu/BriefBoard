export class SimplePDF {
  constructor() {
    this.objects = [];
    this.contentStream = [];
    this.currentPageContent = [];
    this.pageObjects = [];
    this.fontSize = 11;
    this.lineHeight = 15;
    this.yPos = 750; // Start from top (792 height - margin)
    this.xPos = 50;
    this.pageWidth = 612;
    this.pageHeight = 792;
    this.margin = 50;
    this.textWidthLimit = this.pageWidth - (2 * this.margin);
  }

  // Helper to sanitize text for basic PDF fonts
  sanitize(text) {
    return text
      .replace(/[\u2018\u2019]/g, "'") // Smart quotes
      .replace(/[\u201C\u201D]/g, '"') // Smart double quotes
      .replace(/[\u2013\u2014]/g, '-') // Dashes
      .replace(/[\u0000-\u001F\u007F-\uFFFF]/g, " "); // Remove non-printable/non-ascii
  }

  addText(text, options = {}) {
    const { indent = 0, isBold = false } = options;
    const cleanText = this.sanitize(text);
    const lines = cleanText.split('\n');

    lines.forEach(line => {
      this.writeWrappedLine(line, indent);
    });
  }

  writeWrappedLine(line, indent = 0) {
    if (!line) {
      this.yPos -= this.lineHeight; // Empty line
      this.checkPageBreak();
      return;
    }

    const words = line.split(' ');
    let currentLine = "";
    const effectiveWidthLimit = this.textWidthLimit - indent;

    words.forEach(word => {
      const testLine = currentLine + (currentLine ? " " : "") + word;
      // Rough estimation: average char width ~0.5 * fontSize
      const testWidth = testLine.length * (this.fontSize * 0.5);

      if (testWidth > effectiveWidthLimit) {
        this.addToPage(currentLine, indent);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });

    if (currentLine) {
      this.addToPage(currentLine, indent);
    }
  }

  addToPage(text, indent = 0) {
    this.checkPageBreak();

    // Escape parens and backslashes for PDF string format
    const escaped = text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
    
    const x = this.xPos + indent;

    // BT = Begin Text, Tf = Text Font, Td = Text Position, Tj = Show Text, ET = End Text
    this.currentPageContent.push(`BT /F1 ${this.fontSize} Tf ${x} ${this.yPos} Td (${escaped}) Tj ET`);
    this.yPos -= this.lineHeight;
  }

  checkPageBreak() {
    if (this.yPos < this.margin) {
      this.flushPage();
      this.yPos = 750;
    }
  }

  flushPage() {
    if (this.currentPageContent.length === 0) return;
    const content = this.currentPageContent.join('\n');
    this.pageObjects.push(content);
    this.currentPageContent = [];
  }

  generate() {
    this.flushPage();
    if (this.pageObjects.length === 0) this.pageObjects.push("");

    let output = "%PDF-1.4\n";
    const xref = [];
    let offset = output.length;

    const addObj = (id, content) => {
      xref.push(offset);
      const fullObj = `${id} 0 obj\n${content}\nendobj\n`;
      output += fullObj;
      offset += fullObj.length;
    };

    // 1: Catalog, 2: Pages, 3..N: Page Objects, N+1: Font, N+2..M: Content Streams
    const pageCount = this.pageObjects.length;
    const pageIds = [];
    let currentId = 3;

    for (let i = 0; i < pageCount; i++) pageIds.push(currentId++);
    const fontId = currentId++;
    const contentIds = [];
    for (let i = 0; i < pageCount; i++) contentIds.push(currentId++);

    // 1: Catalog
    addObj(1, `<< /Type /Catalog /Pages 2 0 R >>`);

    // 2: Pages Root
    const kidsRef = pageIds.map(id => `${id} 0 R`).join(' ');
    addObj(2, `<< /Type /Pages /Kids [${kidsRef}] /Count ${pageCount} >>`);

    // Page Objects
    for (let i = 0; i < pageCount; i++) {
      addObj(pageIds[i], `<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> /MediaBox [0 0 ${this.pageWidth} ${this.pageHeight}] /Contents ${contentIds[i]} 0 R >>`);
    }

    // Font Object (Standard Helvetica)
    addObj(fontId, `<< /Type /Font /Subtype /Type1 /Name /F1 /BaseFont /Helvetica >>`);

    // Content Streams
    for (let i = 0; i < pageCount; i++) {
      const stream = this.pageObjects[i];
      addObj(contentIds[i], `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
    }

    // Xref & Trailer
    const xrefOffset = offset;
    output += "xref\n0 " + currentId + "\n0000000000 65535 f \n";
    for (let i = 0; i < xref.length; i++) {
      output += xref[i].toString().padStart(10, '0') + " 00000 n \n";
    }

    output += `trailer\n<< /Size ${currentId} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
    return output;
  }
}