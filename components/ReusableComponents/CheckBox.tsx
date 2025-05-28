import React from 'react';

interface CheckboxProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  bold?: boolean;
  disabled?: boolean;
}

export const Checkbox: React.FC<CheckboxProps> = ({ id, label, checked, onChange, disabled, bold = false }) => {
  return (
    <div className="checkbox-wrapper">
      <input
        disabled={!!disabled}
        className="inp-cbx"
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label className="cbx" htmlFor={id}>
        <span>
          {/* Individual SVG check for each instance */}
          <svg width="12px" height="10px" viewBox="0 0 12 10">
            <polyline points="1.5 6 4.5 9 10.5 1"></polyline>
          </svg>
        </span>
        <span className={`mt-[1px] ${bold ? "font-bold" : ""}`}>{label}</span>
      </label>

      <style jsx>{`
        .checkbox-wrapper * {
          box-sizing: border-box;
        }
        .checkbox-wrapper .cbx {
          -webkit-user-select: none;
          user-select: none;
          cursor: pointer;
          padding: 5px 0px;
          border-radius: 6px;
          overflow: hidden;
          transition: all 0.2s ease;
          display: inline-block;
        }
        .checkbox-wrapper .cbx span {
          float: left;
          vertical-align: middle;
          transform: translate3d(0, 0, 0);
        }
        .checkbox-wrapper .cbx span:first-child {
          position: relative;
          width: 15px; 
          height: 15px; 
          border-radius: 4px;
          transform: scale(1);
          border: 1px solid rgb(164, 166, 174);
          transition: all 0.2s ease;
          box-shadow: 0 1px 1px rgba(0, 16, 75, 0.05);
        }
        .checkbox-wrapper .cbx span:first-child svg {
          position: absolute;
          top: 2px;
          left: 0.5px;
          fill: none;
          stroke: #fff;
          stroke-width: 2;
          stroke-linecap: round;
          stroke-linejoin: round;
          stroke-dasharray: 16px;
          stroke-dashoffset: 16px;
          transition: all 0.3s ease;
          transition-delay: 0.1s;
          transform: translate3d(0, 0, 0);
        }
        .checkbox-wrapper .cbx span:last-child {
          padding-left: 8px;
          line-height: 14px;
        }
        .checkbox-wrapper .inp-cbx {
          position: absolute;
          visibility: hidden; /* Hide the default checkbox */
        }
        .checkbox-wrapper .inp-cbx:checked + .cbx span:first-child {
          background: #07f;
          border-color: #07f;
          animation: wave-4 0.4s ease;
        }
        .checkbox-wrapper .inp-cbx:checked + .cbx span:first-child svg {
          stroke-dashoffset: 0;
        }
        @keyframes wave-4 {
          50% {
            transform: scale(0.9);
          }
        }
      `}</style>
    </div>
  );
};

export default Checkbox;
