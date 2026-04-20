import './Footer.css';

export default function Footer() {
  return (
    <footer className="app-footer">
      <p>&copy; {new Date().getFullYear()} Finance Hub || All rights reserved</p>
    </footer>
  );
}
