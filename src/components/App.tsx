import { useState, useEffect } from "react";
import Clock from "./Clock";
import Form from "./Form";
import Logo from "./Logo";
import ExportModal from "./ExportModal";

const PROMPT_SCAN = "Swipe ID (top barcode) or enter OSIS — do not check in for others";
const PROMPT_OTHER_BARCODE = "Wrong barcode — swipe top barcode on ID";
const PROMPT_OK = "OK";

export default function App() {
    const [lastPromptTime, setLastPromptTime] = useState(null);
    const [promptText, setPromptText] = useState(PROMPT_SCAN);
    const [exportModalOpen, setExportModalOpen] = useState(false);

    function handleSubmit(name: string) {
        let text = PROMPT_OK;
        if (name) {
            text += ` — ${name}`;
        }
        setPromptText(text);
        setLastPromptTime(new Date());
    }

    function handleWrongBarcode() {
        setPromptText(PROMPT_OTHER_BARCODE);
        setLastPromptTime(new Date());
    }

    useEffect(() => {
        if (lastPromptTime === null) {
            return;
        }

        let promptTime;
        if (promptText.startsWith(PROMPT_OK)) {
            promptTime = 1500;
        } else if (promptText === PROMPT_OTHER_BARCODE) {
            promptTime = 10000;
        }

        const timeout = setTimeout(() => setPromptText(PROMPT_SCAN), promptTime);
        return () => clearTimeout(timeout);
    }, [lastPromptTime]);

    let footerClass = "footer";
    if (promptText.startsWith(PROMPT_OK)) {
        footerClass += " ok";
    } else if (promptText === PROMPT_OTHER_BARCODE) {
        footerClass += " error";
    }

    return (
        <>
            <h1 className="title">StuyPulse Attendance Kiosk</h1>
            <div className="row">
                <div className="column">
                    <Logo openModal={() => setExportModalOpen(true)} />
                    <Clock />
                </div>
                <div className="column">
                    <Form
                        isActive={!exportModalOpen}
                        onSuccess={handleSubmit}
                        onWrongBarcode={handleWrongBarcode} />
                </div>
            </div>
            <div className={footerClass}>
                <p className="prompt">{promptText}</p>
            </div>
            <ExportModal
                isOpen={exportModalOpen}
                onClose={() => setExportModalOpen(false)} />
        </>
    );
}
