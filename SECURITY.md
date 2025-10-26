# Security Policy

## Supported Versions

The Concerto project follows semantic versioning. We provide security updates for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 3.x.x   | :white_check_mark: |
| 2.x.x   | :x:                |
| < 2.0   | :x:                |

We strongly recommend using the latest stable release to ensure you have the most recent security patches and updates.

## Reporting a Vulnerability

The Concerto team and community take security bugs seriously. We appreciate your efforts to responsibly disclose your findings and will make every effort to acknowledge your contributions.

### How to Report a Security Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities by emailing:

**security@accordproject.org**

or by contacting the LF Projects Manager at:

**manager@lfprojects.org**

### What to Include in Your Report

To help us better understand and resolve the issue, please include as much of the following information as possible:

- Type of issue (e.g., buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit it

### What to Expect

After submitting a vulnerability report, you can expect:

1. **Acknowledgment**: We will acknowledge receipt of your vulnerability report within **3 business days**.

2. **Assessment**: Our security team will investigate and assess the reported vulnerability. We will provide an initial assessment within **7 business days**.

3. **Updates**: We will keep you informed about the progress of addressing the vulnerability at reasonable intervals.

4. **Resolution**: Once the vulnerability is confirmed and a fix is available:
   - We will prepare a security advisory
   - Release a patched version
   - Publicly disclose the vulnerability with appropriate credit to you (if desired)

5. **Timeline**: We aim to release security patches within **30 days** for critical vulnerabilities and **90 days** for other vulnerabilities, depending on complexity.

### Disclosure Policy

- Please give us reasonable time to address the issue before public disclosure.
- We will coordinate with you on the disclosure timeline.
- We believe in transparency and will publicly disclose vulnerabilities once patches are available.

### Safe Harbor

The Concerto project supports safe harbor for security researchers who:

- Make a good faith effort to avoid privacy violations, destruction of data, and interruption or degradation of our services
- Only interact with accounts you own or with explicit permission of the account holder
- Do not exploit a security issue beyond what is necessary to demonstrate it
- Report vulnerabilities promptly

We will not pursue legal action against researchers who follow these guidelines.

## Security Updates and Advisories

Security updates and advisories will be published:

- In the project's [GitHub Security Advisories](https://github.com/accordproject/concerto/security/advisories)
- Through release notes for patched versions
- On the [Accord Project website](https://www.accordproject.org/)
- Via the [Accord Project Discord](https://discord.com/invite/Zm99SKhhtA)

## Security Best Practices

When using Concerto in your projects, we recommend:

1. **Keep Updated**: Always use the latest stable version of Concerto packages
2. **Validate Input**: Always validate and sanitize data before processing with Concerto models
3. **Review Dependencies**: Regularly audit your project dependencies for known vulnerabilities
4. **Follow Secure Coding**: Follow secure coding practices when implementing Concerto-based solutions
5. **Monitor Advisories**: Subscribe to security advisories for timely updates

## Contact

For general security questions or concerns, please contact:

- **Security Email:** security@accordproject.org
- **LF Projects Manager:** manager@lfprojects.org
- **Discord Community:** https://discord.com/invite/Zm99SKhhtA

For more information about the Accord Project and Concerto, visit [https://www.accordproject.org/](https://www.accordproject.org/)

---

Thank you for helping keep Concerto and the Accord Project community safe!
