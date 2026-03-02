/**
 * pdf-rename.js
 * Handles renaming PDFs based on captured text and exporting as ZIP.
 */
document.getElementById('rename-btn').addEventListener('click', async () => {
    // 1. Validate Single Keyword Rule
    const tags = document.querySelectorAll('.tag');
    if (tags.length !== 1) {
        alert("Only accept 1 keyword for renaming. Please remove extra keywords and scan again.");
        // Reset UI for safety
        document.getElementById('results-output').innerHTML = "No fragments scanned.";
        document.getElementById('rename-btn').style.display = 'none';
        document.getElementById('download-btn').style.display = 'none';
        return;
    }

    if (!capturedResults || capturedResults.length === 0) {
        return alert("No captured text found. Please run a scan first.");
    }

    const renameBtn = document.getElementById('rename-btn');
    renameBtn.innerHTML = "🌀 Processing Crystals...";
    
    try {
        const zip = new JSZip();

        for (const result of capturedResults) {
            // Find the original file object
            const originalFile = uploadedFiles.find(f => f.name === result.file);
            if (!originalFile) continue;

            // Clean the name: Remove characters that OS file systems don't like
            let newName = result.context
                .replace(/[\\/:*?"<>|]/g, "") // Remove illegal filename chars
                .replace(/[\$#:/\*]/g, "")    // Specifically remove your filtered chars
                .trim();

            // Fallback if captured text is empty
            if (!newName || newName === "No fragment captured") {
                newName = `Unnamed_Fragment_${Math.floor(Math.random() * 1000)}`;
            }

            const arrayBuffer = await originalFile.arrayBuffer();
            zip.file(`${newName}.pdf`, arrayBuffer);
        }

        // Generate and download the ZIP
        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, "Matth-el-PDF-Extractor-.zip");

    } catch (error) {
        console.error("Renaming failed:", error);
        alert("The nebula interfered with renaming. Check console for details.");
    } finally {
        renameBtn.innerHTML = "Rename & Export Zip";
    }
});