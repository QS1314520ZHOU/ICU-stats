Name:           icu-stats
Version:        1.0.0
Release:        1%{?dist}
Summary:        ICU micro-pump and oxygen therapy duration dashboard
License:        Proprietary
BuildArch:      x86_64

%description
ICU Stats web dashboard packaged for Oracle Enterprise Linux 8.2.

%prep

%build

%install
rm -rf %{buildroot}
mkdir -p %{buildroot}/opt/icu-stats
mkdir -p %{buildroot}/etc/icu-stats
mkdir -p %{buildroot}/usr/bin
mkdir -p %{buildroot}/usr/lib/systemd/system

cp -a %{_sourcedir}/icu-stats %{buildroot}/opt/icu-stats/icu-stats
cp -a %{_sourcedir}/frontend %{buildroot}/opt/icu-stats/frontend
cp -a %{_sourcedir}/icu-stats.env %{buildroot}/etc/icu-stats/icu-stats.env
cp -a %{_sourcedir}/icu-stats.service %{buildroot}/usr/lib/systemd/system/icu-stats.service
cp -a %{_sourcedir}/icu-stats-wrapper.sh %{buildroot}/usr/bin/icu-stats
chmod 0755 %{buildroot}/opt/icu-stats/icu-stats
chmod 0755 %{buildroot}/usr/bin/icu-stats

%post
if command -v systemctl >/dev/null 2>&1; then
  systemctl daemon-reload >/dev/null 2>&1 || true
fi

%preun
if [ "$1" = "0" ] && command -v systemctl >/dev/null 2>&1; then
  systemctl stop icu-stats.service >/dev/null 2>&1 || true
  systemctl disable icu-stats.service >/dev/null 2>&1 || true
fi

%postun
if command -v systemctl >/dev/null 2>&1; then
  systemctl daemon-reload >/dev/null 2>&1 || true
fi

%files
%dir /opt/icu-stats
/opt/icu-stats/icu-stats
/opt/icu-stats/frontend
/usr/bin/icu-stats
/usr/lib/systemd/system/icu-stats.service
%config(noreplace) /etc/icu-stats/icu-stats.env

%changelog
* Thu May 07 2026 ICU Stats <icu-stats@example.local> - 1.0.0-1
- Initial OEL 8.2 RPM package.
