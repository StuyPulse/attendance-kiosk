import React, { useState, useEffect } from "react";

interface FormProps {
    onSubmit: () => void;
}

function isDigit(c: string) {
    return c >= "0" && c <= "9";
}

export default function Form({ onSubmit }: FormProps) {
    const [idNumber, setIdNumber] = useState("");
    const [isLastInputFromNumpad, setIsLastInputFromNumpad] = useState(false);
    const [lastShakeTime, setLastShakeTime] = useState(null);
    const [isShaking, setIsShaking] = useState(false);
    const [backspaceDownTime, setBackspaceDownTime] = useState(null);

    function handleNumpadButtonClick(e: React.MouseEvent<HTMLButtonElement>) {
        const value = e.currentTarget.value;
        if (value === "submit") {
            onSubmit();
        } else {
            setIdNumber(idNumber + value);
        }
        setIsLastInputFromNumpad(true);
    }

    function handleBackspaceDown() {
        setBackspaceDownTime(new Date());
    }

    function handleBackspaceUp() {
        setIdNumber(idNumber.slice(0, -1));
        setBackspaceDownTime(null);
    }

    function handleBackspaceLeave() {
        setBackspaceDownTime(null);
    }

    function handleChangeFromKeyboardInput(e: React.ChangeEvent<HTMLInputElement>) {
        const value = e.target.value;
        if (isLastInputFromNumpad && (e.nativeEvent as InputEvent).inputType === "deleteContentBackward") {
            setIdNumber("");
        } else if (value.length === 0) {
            setIdNumber("")
        } else if (isDigit(value[value.length - 1])) {
            if (isLastInputFromNumpad) {
                setIdNumber(value[value.length - 1]);
            } else {
                setIdNumber(value);
            }
            setIsLastInputFromNumpad(false);
        }
    }

    function handleSubmit(event: React.FormEvent) {
        event.preventDefault();
        if (idNumber.length !== 9 && idNumber.length != 13) {
            setLastShakeTime(new Date());
            return;
        }
        setIdNumber("");
        onSubmit();
    }

    useEffect(() => {
        if (lastShakeTime === null) {
            return;
        }
        setIsShaking(true);
        const timeout = setTimeout(() => setIsShaking(false), 400);
        return () => clearTimeout(timeout);
    }, [lastShakeTime]);

    useEffect(() => {
        if (backspaceDownTime === null) {
            return;
        }
        const timeout = setTimeout(() => setIdNumber(""), 500);
        return () => clearTimeout(timeout);
    }, [backspaceDownTime]);

    return <div>
        <form onSubmit={handleSubmit}>
            <input
                type="text"
                name="idNumber"
                className={"idNumberInput" + (isShaking ? " shake" : "")}
                value={idNumber}
                onChange={handleChangeFromKeyboardInput}
                onBlur={(e) => e.target.focus()}
                autoFocus />
        </form>
        <div className="numpad">
            {Array.from({length: 9}, (_, i) => (
                <button key={i + 1} value={i + 1} onClick={handleNumpadButtonClick}>{i + 1}</button>
            ))}
            <button
                value="backspace"
                onMouseDown={handleBackspaceDown}
                onMouseUp={handleBackspaceUp}
                onMouseLeave={handleBackspaceLeave}>⌫</button>
            <button value="0" onClick={handleNumpadButtonClick}>0</button>
            <button value="submit" onClick={handleSubmit}>⏎</button>
        </div>
    </div>;
}
