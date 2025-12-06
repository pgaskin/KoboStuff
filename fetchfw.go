//go:build ignore

package main

import (
	"bytes"
	"crypto/md5"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"maps"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"
)

func main() {
	if len(os.Args) <= 1 {
		os.Exit(2)
	}
	for _, u := range os.Args[1:] {
		if err := download(u); err != nil {
			if !errors.Is(err, os.ErrExist) {
				fmt.Fprintf(os.Stderr, "error: %s: %v\n", u, err)
				os.Exit(1)
			}
			fmt.Fprintf(os.Stderr, "warning: %s: %v\n", u, err)
		}
	}
	if _, err := times("firmwares"); err != nil {
		fmt.Fprintf(os.Stderr, "error: update times: %v\n", err)
		os.Exit(1)
	}
}

func download(u string) error {
	url, err := url.Parse(u)
	if err != nil {
		return err
	}
	if url.Scheme == "" || url.Host == "" || url.ForceQuery || url.RawQuery != "" || url.RawFragment != "" || url.Opaque != "" {
		return fmt.Errorf("bad url format")
	}

	var name string
	if i := strings.Index(url.Path, "/firmwares/"); i == -1 {
		return fmt.Errorf("extract path: does not contain /firmwares/")
	} else if x, err := filepath.Localize(url.Path[i+1:]); err != nil {
		return fmt.Errorf("localize path: %w", err)
	} else {
		name = x
	}
	dir := filepath.Dir(name)

	if _, err := os.Stat(name); err != nil && !errors.Is(err, fs.ErrNotExist) {
		return err
	} else if err == nil {
		return os.ErrExist
	}

	resp, err := http.Get(u)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("response status %d", resp.StatusCode)
	}

	var headers bytes.Buffer
	if _, err := fmt.Fprintf(&headers, "%s\r\n", u); err != nil {
		return err
	}
	if _, err := fmt.Fprintf(&headers, "HTTP/%d.%d %03d\r\n", resp.ProtoMajor, resp.ProtoMinor, resp.StatusCode); err != nil {
		return err
	}
	for _, key := range slices.Sorted(maps.Keys(resp.Header)) {
		for _, value := range resp.Header[key] {
			if _, err := fmt.Fprintf(&headers, "%s: %s\r\n", strings.ToLower(key), value); err != nil {
				return err
			}
		}
	}
	if _, err := fmt.Fprintf(&headers, "\r\n"); err != nil {
		return err
	}

	mod, err := time.Parse(http.TimeFormat, resp.Header.Get("Last-Modified"))
	if err != nil {
		return fmt.Errorf("parse modified time: %w", err)
	}

	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	f, err := os.CreateTemp(dir, ".tmp")
	if err != nil {
		return err
	}
	defer func() {
		if f != nil {
			f.Close()
			if err := os.Remove(f.Name()); err != nil {
				fmt.Fprintf(os.Stderr, "warning: failed to remove %q: %v\n", f.Name(), err)
			}
		}
	}()

	sum := md5.New()
	if _, err := io.Copy(f, io.TeeReader(resp.Body, sum)); err != nil {
		return err
	}
	md5 := sum.Sum(nil)

	if err := f.Close(); err != nil {
		return err
	}
	if err := os.Chtimes(f.Name(), time.Time{}, mod); err != nil {
		return err
	}
	if err := os.Chmod(f.Name(), 0644); err != nil {
		return err
	}
	if err := os.Rename(f.Name(), name); err != nil {
		return err
	}
	f = nil

	if err := appendFile("headers.txt", headers.Bytes(), 0644); err != nil {
		return err
	}
	if err := appendFile("MD5SUMS", []byte(hex.EncodeToString(md5)+"  ./"+name+"\n"), 0644); err != nil {
		return err
	}

	fmt.Printf("downloaded: %x %s\n", md5, name)
	return nil
}

func appendFile(name string, data []byte, perm os.FileMode) error {
	f, err := os.OpenFile(name, os.O_CREATE|os.O_APPEND|os.O_WRONLY, perm)
	if err != nil {
		return err
	}
	defer f.Close()

	if _, err := f.Write(data); err != nil {
		return err
	}
	return f.Close()
}

func times(name string) (time.Time, error) {
	fi, err := os.Stat(name)
	if err != nil {
		return time.Time{}, err
	}
	if !fi.IsDir() {
		return fi.ModTime(), nil
	}

	es, err := os.ReadDir(name)
	if err != nil {
		return time.Time{}, err
	}
	if len(es) == 0 {
		fmt.Printf("times: ignoring empty directory %q\n", name)
		return time.Time{}, nil
	}

	var newest time.Time
	for _, e := range es {
		t, err := times(filepath.Join(name, e.Name()))
		if err != nil {
			return time.Time{}, err
		}
		if t.After(newest) {
			newest = t
		}
	}
	if !newest.IsZero() && !fi.ModTime().Equal(newest) {
		fmt.Printf("times: changing %q from %s to %s\n", name, fi.ModTime(), newest)
		if err := os.Chtimes(name, time.Time{}, newest); err != nil {
			return newest, err
		}
	}
	return newest, nil
}
